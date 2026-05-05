import * as Tone from 'tone';
import type { DelayMode, DelaySubdivision, ReverbType, TrackFx } from './types';

/**
 * Gemensam master-buss med limiter så det aldrig clippar, oavsett hur många
 * spår som spelar samtidigt eller vilka per-spår volymer användaren ställt in.
 *
 * Signalväg per spår:
 *   voice → input → duck → panner → ┬→ dry ────────────────────────→ master
 *                                   ├→ delay (per-spår-instans) ────→ master
 *                                   ├→ reverbSend → vald typ ───────→ master
 *                                   │   (hall | plate | spring | shimmer)
 *                                   ├→ saturation (parallell) ──────→ master
 *                                   ├→ chorus (per-spår, wet-only) ─→ master
 *                                   └→ bitcrusher (per-spår, wet-only) → master
 *
 * Designval kring resurser:
 * - Reverb är dyrt (genererar IR async) → vi har FYRA globala instanser,
 *   en per typ. Spåret väljer typ + send-nivå. Det ger 90 % av flexibiliteten
 *   i per-spår-reverb till bråkdelen av CPU/minnes-kostnaden av per-spår-IR.
 * - Shimmer:n är en hall-reverb med en pitchshift-+12 i feedback-loopen — den
 *   tinglande kvalitén kommer från att svansens högfrekvenser hela tiden
 *   transponeras upp en oktav.
 * - Delay däremot är billigt — varje spår får egen instans så feedback,
 *   tid och tape-mode kan variera fritt utan att skapa korsfeedback mellan spår.
 */

export const REVERB_TYPES: ReverbType[] = ['hall', 'plate', 'spring', 'shimmer'];

/** Visningsnamn + kort beskrivning för reverb-typ-väljaren i UI:t. */
export const REVERB_LABELS: Record<ReverbType, { label: string; hint: string }> = {
  hall: { label: 'Hall', hint: 'Lång varm konsertsal · 5.5 s' },
  plate: { label: 'Plate', hint: 'Ljus EMT-känsla · 2.2 s' },
  spring: { label: 'Spring', hint: 'Twangy fjäder · 0.9 s' },
  shimmer: { label: 'Shimmer', hint: '+12 i feedback · 7 s · pad-magi' },
};

type ReverbBus = {
  type: ReverbType;
  input: Tone.Gain;
  output: Tone.Gain;
};

/**
 * BusContext är en samling av master + 4 reverb-bussar bundna till en
 * specifik Tone-AudioContext. Live-läget använder en singleton (skapad i
 * AudioContext.default), medan WAV-export-renderingen skapar en ny instans
 * inne i `Tone.Offline()`-callbacken.
 */
export type BusContext = {
  masterInput: Tone.InputNode;
  /** Mottagare för reverb-sends per typ. */
  reverbInputFor(type: ReverbType): Tone.InputNode;
};

let initialized = false;
let masterInput: Tone.Gain | null = null;
let masterVolume: Tone.Volume | null = null;
let limiter: Tone.Limiter | null = null;
const reverbBuses: Record<ReverbType, ReverbBus | null> = {
  hall: null,
  plate: null,
  spring: null,
  shimmer: null,
};

/** Bygg en hall-reverb (lång, varm konsertsalsklang). */
function buildHall(masterDest: Tone.InputNode): ReverbBus {
  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);
  const rev = new Tone.Reverb({ decay: 5.5, preDelay: 0.025, wet: 1 });
  void rev.generate();
  input.connect(rev);
  rev.connect(output);
  output.connect(masterDest);
  return { type: 'hall', input, output };
}

/** Plate: ljusare, snabbare attack — drum-rooms, lead-färg, klassisk EMT-känsla. */
function buildPlate(masterDest: Tone.InputNode): ReverbBus {
  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);
  const rev = new Tone.Reverb({ decay: 2.2, preDelay: 0.008, wet: 1 });
  void rev.generate();
  // Lite high-shelf-boost ger plate:n det där "metalliska skimmeret".
  const tone = new Tone.EQ3({ low: -2, mid: 0, high: 4 });
  input.connect(rev);
  rev.connect(tone);
  tone.connect(output);
  output.connect(masterDest);
  return { type: 'plate', input, output };
}

/** Spring: kort + tunn med en metallisk resonans i mellanregistret. */
function buildSpring(masterDest: Tone.InputNode): ReverbBus {
  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);
  const rev = new Tone.Reverb({ decay: 0.9, preDelay: 0.005, wet: 1 });
  void rev.generate();
  // Twangy resonans-peak runt 1.2 kHz + lågpass på topp så det inte blir grellt.
  const peak = new Tone.Filter({ type: 'peaking', frequency: 1200, Q: 4, gain: 9 });
  const lp = new Tone.Filter({ type: 'lowpass', frequency: 5500, Q: 0.7 });
  input.connect(rev);
  rev.connect(peak);
  peak.connect(lp);
  lp.connect(output);
  output.connect(masterDest);
  return { type: 'spring', input, output };
}

/**
 * Shimmer: hall-svans + +12 halvtoner pitch-shift mixat direkt i output OCH
 * loopat tillbaka in i reverb:n. Två signalvägar = den klassiska tjocka
 * shimmer-magin:
 *   1. Direkta shimmer-lagret hörs OMEDELBART — du fattar att det är på.
 *   2. Feedback-loopen bygger upp ett moln av oktav-uppstigande korn som
 *      ringer kvar långt efter dry-attacken.
 *
 * Tidigare implementation gick bara via feedback → effekten var så subtil
 * att A/B-jämförelsen mot Hall knappt hördes.
 */
function buildShimmer(masterDest: Tone.InputNode): ReverbBus {
  const input = new Tone.Gain(1);
  const output = new Tone.Gain(1);
  const rev = new Tone.Reverb({ decay: 8, preDelay: 0.05, wet: 1 });
  void rev.generate();
  // PitchShift +12 = en oktav upp. windowSize 0.1 ger jämnt moln utan att
  // det börjar hacka. wet:1 så vi får RENT pitch-shiftad signal ut.
  const shifter = new Tone.PitchShift({
    pitch: 12,
    windowSize: 0.1,
    feedback: 0,
    wet: 1,
  });
  // Direkta shimmer-lagret som mixas in i output — det är detta som gör
  // skillnaden uppenbar mellan Hall och Shimmer.
  const shimmerLayer = new Tone.Gain(0.7);
  // Feedback-loopen tillbaka in i reverb. ~0.55 ger fyllig build-up utan
  // att gå mot self-oscillation (reverb-decay attenuerar redan signalen
  // varje round-trip, så stabilitet är säkrad).
  const feedbackGain = new Tone.Gain(0.55);
  // Mild high-pass tar bort sub-rumling i feedback-loopen så det inte mosar
  // ihop sig till en bas-dröning vid lång svans.
  const fbHpf = new Tone.Filter({ type: 'highpass', frequency: 250, Q: 0.7 });

  input.connect(rev);
  rev.connect(output);
  // Pitch-shiftad signal går till BÅDA:
  //   (a) output via shimmerLayer-gain → omedelbart hörbart oktav-lager
  //   (b) feedback-loopen → cascading svans-build-up
  rev.connect(shifter);
  shifter.connect(shimmerLayer);
  shimmerLayer.connect(output);
  shifter.connect(fbHpf);
  fbHpf.connect(feedbackGain);
  feedbackGain.connect(input);
  output.connect(masterDest);
  return { type: 'shimmer', input, output };
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  masterInput = new Tone.Gain(1);
  masterVolume = new Tone.Volume(0);
  limiter = new Tone.Limiter(-0.5);

  // Master-summering
  masterInput.connect(masterVolume);
  masterVolume.connect(limiter);
  limiter.toDestination();

  // Bygg alla fyra reverb-typer. Reverb-svansarna går in före limitern
  // (post-limiter skulle låta reverb klippa helt självt vid hög wet).
  reverbBuses.hall = buildHall(masterVolume);
  reverbBuses.plate = buildPlate(masterVolume);
  reverbBuses.spring = buildSpring(masterVolume);
  reverbBuses.shimmer = buildShimmer(masterVolume);
}

/** Internt: hämta reverb-bussens input-node för en given typ (live-singleton). */
function reverbInputFor(type: ReverbType): Tone.InputNode {
  ensureInit();
  return reverbBuses[type]!.input;
}

/**
 * Bygger en helt ny bus-instans i den aktuella Tone-kontexten och routar
 * masterns output till `finalDest`. Används av WAV-export inne i
 * Tone.Offline-callbacken där den globala singletonen inte finns.
 *
 * Returnerar både BusContext (för TrackFxChain) och de underliggande noderna
 * så anroparen kan dispose:a dem efter att rendrering är klar.
 */
export function createOfflineBus(finalDest: Tone.InputNode): {
  ctx: BusContext;
  dispose(): void;
} {
  const offlineMasterInput = new Tone.Gain(1);
  const offlineMasterVolume = new Tone.Volume(0);
  const offlineLimiter = new Tone.Limiter(-0.5);
  offlineMasterInput.connect(offlineMasterVolume);
  offlineMasterVolume.connect(offlineLimiter);
  offlineLimiter.connect(finalDest);

  // Reverb-bussar går in före limitern så svansen begränsas tillsammans
  // med torrsignalen — annars kan en hög wet låta reverb klippa solo.
  const offlineBuses: Record<ReverbType, ReverbBus> = {
    hall: buildHall(offlineMasterVolume),
    plate: buildPlate(offlineMasterVolume),
    spring: buildSpring(offlineMasterVolume),
    shimmer: buildShimmer(offlineMasterVolume),
  };

  return {
    ctx: {
      masterInput: offlineMasterInput,
      reverbInputFor: (type) => offlineBuses[type].input,
    },
    dispose() {
      // Nedstigande dispose — viktigt så ToneAudioContext stänger korrekt.
      offlineLimiter.disconnect();
      offlineMasterVolume.disconnect();
      offlineMasterInput.disconnect();
      offlineLimiter.dispose();
      offlineMasterVolume.dispose();
      offlineMasterInput.dispose();
      for (const type of REVERB_TYPES) {
        offlineBuses[type].input.disconnect();
        offlineBuses[type].output.disconnect();
        offlineBuses[type].input.dispose();
        offlineBuses[type].output.dispose();
      }
    },
  };
}

export function getMasterInput(): Tone.InputNode {
  ensureInit();
  return masterInput!;
}

export function setMasterVolumeDb(db: number) {
  ensureInit();
  masterVolume!.volume.value = db;
}

/**
 * Per-spår delay-enhet. Hanterar alla tre lägen (pingpong/mono/tape) genom
 * att bygga om internt vid mode-byte. Tape-mode = mono-feedback-delay med
 * en LFO som modulerar delayTime ±5% → klassiskt vintage tape-svaj.
 *
 * Delay-instansen är encapsulated så TrackFxChain bara behöver tala om
 * "send hit" och "wet 0.4" — implementeringen tar hand om resten.
 */
class DelayUnit {
  private node: Tone.PingPongDelay | Tone.FeedbackDelay;
  private modLfo: Tone.LFO | null = null;
  private input: Tone.Gain;
  private outputDest: Tone.InputNode;
  private mode: DelayMode;

  constructor(mode: DelayMode, time: DelaySubdivision, feedback: number, dest: Tone.InputNode) {
    this.mode = mode;
    this.input = new Tone.Gain(1);
    this.outputDest = dest;
    this.node = this.createNode(mode, time, feedback);
    this.input.connect(this.node);
    this.node.connect(dest);
    if (mode === 'tape') this.attachTapeLfo();
  }

  private createNode(
    mode: DelayMode,
    time: DelaySubdivision,
    feedback: number,
  ): Tone.PingPongDelay | Tone.FeedbackDelay {
    const fb = Math.max(0, Math.min(0.95, feedback));
    if (mode === 'pingpong') {
      return new Tone.PingPongDelay({ delayTime: time, feedback: fb, wet: 1 });
    }
    // mono OCH tape använder FeedbackDelay; tape får extra LFO-modulation
    return new Tone.FeedbackDelay({ delayTime: time, feedback: fb, wet: 1 });
  }

  private attachTapeLfo() {
    if (this.modLfo) {
      this.modLfo.disconnect();
      this.modLfo.dispose();
    }
    // Långsam triangel-LFO på delayTime för pitch-svaj. ±5 % av nuvarande tid.
    // Tone.LFO outputtar sin signal → vi connect:ar den till delayTime-param.
    // delayTime.value kan vara antingen number eller subdivision-sträng
    // (t.ex. "8n") beroende på hur den initialiserats — Tone.Time normaliserar.
    const baseTime = Tone.Time(this.node.delayTime.value).toSeconds();
    const min = baseTime * 0.95;
    const max = baseTime * 1.05;
    const lfo = new Tone.LFO({ frequency: 0.4, type: 'triangle', min, max }).start();
    lfo.connect(this.node.delayTime);
    this.modLfo = lfo;
  }

  setMode(mode: DelayMode, time: DelaySubdivision, feedback: number) {
    if (mode === this.mode) {
      // Ingen rebuild — bara uppdatera tid + fb
      this.setTime(time);
      this.node.feedback.value = Math.max(0, Math.min(0.95, feedback));
      return;
    }
    // Mode bytt → bygg om
    this.input.disconnect();
    this.modLfo?.disconnect();
    this.modLfo?.dispose();
    this.modLfo = null;
    this.node.disconnect();
    this.node.dispose();
    this.mode = mode;
    this.node = this.createNode(mode, time, feedback);
    this.input.connect(this.node);
    this.node.connect(this.outputDest);
    if (mode === 'tape') this.attachTapeLfo();
  }

  setTime(time: DelaySubdivision) {
    const sec = Tone.Time(time).toSeconds();
    this.node.delayTime.value = sec;
    if (this.mode === 'tape' && this.modLfo) {
      // Behåll ±5 % runt nya tiden
      this.modLfo.min = sec * 0.95;
      this.modLfo.max = sec * 1.05;
    }
  }

  setFeedback(feedback: number) {
    this.node.feedback.value = Math.max(0, Math.min(0.95, feedback));
  }

  getInput(): Tone.InputNode {
    return this.input;
  }

  dispose() {
    this.input.disconnect();
    this.input.dispose();
    this.modLfo?.disconnect();
    this.modLfo?.dispose();
    this.node.disconnect();
    this.node.dispose();
  }
}

/**
 * Per-spår FX-kedja. Hanterar pan, dry, delay, två reverb-sends, saturation,
 * chorus och bitcrusher. Varje spår får sin egen instans → ljuden korsar inte
 * varandra och vi kan ha helt olika FX-färg per spår.
 *
 * Mixa wet-nivåer via `setFx`. `dispose()` stänger ner hela kedjan.
 */
export class TrackFxChain {
  private input: Tone.Gain;
  /**
   * Duck-gain för sidechain. Sitter mellan input och panner så hela
   * signalen (dry + alla sends) dippas i takt. Default 1.0 (ingen duck).
   * Pump-envelopen schedulas via applyDuck() från sequencer.tick.
   */
  private duckGain: Tone.Gain;
  private panner: Tone.Panner;
  private drySend: Tone.Gain;
  // Delay
  private delaySend: Tone.Gain;
  private delayUnit: DelayUnit;
  // Reverb — en send + pre-delay + en typ-router-gain per typ. När typ ändras
  // sätts den valda gainen till 1 och övriga till 0 (smooth ramp), vilket
  // undviker discontinuities/clicks och låter pågående svansar dö ut naturligt.
  private reverbSend: Tone.Gain;
  private reverbPreDelay: Tone.Delay;
  private reverbTypeGains: Record<ReverbType, Tone.Gain>;
  // Saturation
  private satSend: Tone.Gain;
  private saturation: Tone.Distortion;
  // Chorus (parallell wet-only — torrt går via dry, chorus-väg lägger på effekten)
  private chorusSend: Tone.Gain;
  private chorus: Tone.Chorus;
  // Bitcrusher (parallell wet-only)
  private crusherSend: Tone.Gain;
  private crusher: Tone.BitCrusher;
  private disposed = false;

  /**
   * @param initial Initiala FX-värden (kopieras direkt till noderna via setFx)
   * @param bus     Valfri BusContext — anges för WAV-offline-rendering.
   *                Default = singleton-buss (live-läget).
   */
  constructor(initial: TrackFx, bus?: BusContext) {
    let masterDest: Tone.InputNode;
    let getReverbInput: (type: ReverbType) => Tone.InputNode;
    if (bus) {
      masterDest = bus.masterInput;
      getReverbInput = bus.reverbInputFor;
    } else {
      ensureInit();
      masterDest = masterInput!;
      getReverbInput = reverbInputFor;
    }
    this.input = new Tone.Gain(1);
    this.duckGain = new Tone.Gain(1);
    this.panner = new Tone.Panner(0);
    this.drySend = new Tone.Gain(1);

    this.delaySend = new Tone.Gain(0);
    this.delayUnit = new DelayUnit('pingpong', '8n', 0.35, masterDest);

    this.reverbSend = new Tone.Gain(0);
    this.reverbPreDelay = new Tone.Delay({ delayTime: 0, maxDelay: 0.2 });
    this.reverbTypeGains = {
      hall: new Tone.Gain(0),
      plate: new Tone.Gain(0),
      spring: new Tone.Gain(0),
      shimmer: new Tone.Gain(0),
    };

    this.satSend = new Tone.Gain(0);
    this.saturation = new Tone.Distortion({ distortion: 0.4, oversample: '2x', wet: 1 });

    this.chorusSend = new Tone.Gain(0);
    // Tone.Chorus är en wet/dry-effekt — vi kör wet=1 och styr mängden via send-nivå.
    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      type: 'sine',
      spread: 180,
      wet: 1,
    }).start();

    this.crusherSend = new Tone.Gain(0);
    this.crusher = new Tone.BitCrusher(8);

    // input → duck → panner → fanout. Duck:en sitter FÖRST så pumpen
    // påverkar både dry och alla sends — annars skulle reverb-svansen
    // fortsätta otrampad medan dry pumpar, vilket låter konstigt.
    this.input.connect(this.duckGain);
    this.duckGain.connect(this.panner);
    this.panner.connect(this.drySend);
    this.panner.connect(this.delaySend);
    this.panner.connect(this.reverbSend);
    this.panner.connect(this.satSend);
    this.panner.connect(this.chorusSend);
    this.panner.connect(this.crusherSend);

    // Dry + parallell-effekter → master
    this.drySend.connect(masterDest);
    this.satSend.connect(this.saturation);
    this.saturation.connect(masterDest);
    this.chorusSend.connect(this.chorus);
    this.chorus.connect(masterDest);
    this.crusherSend.connect(this.crusher);
    this.crusher.connect(masterDest);

    // Delay routas via DelayUnit (output redan kopplad till masterDest)
    this.delaySend.connect(this.delayUnit.getInput());

    // Reverb-routing: send → pre-delay → 4 type-router-gains → respektive bus.
    // Bara den valda typens gain är på 1; övriga på 0. setFx() byter ramp.
    this.reverbSend.connect(this.reverbPreDelay);
    for (const type of REVERB_TYPES) {
      this.reverbPreDelay.connect(this.reverbTypeGains[type]);
      this.reverbTypeGains[type].connect(getReverbInput(type));
    }

    this.setFx(initial);
  }

  /** Stereoposition: -1 vänster, 0 mitt, 1 höger. */
  setPan(pan: number) {
    if (this.disposed) return;
    const p = Math.max(-1, Math.min(1, pan));
    this.panner.pan.value = p;
  }

  /**
   * Schedulera en duck-puls: snabb attack ner till (1 - amount), sedan
   * linjär ramp tillbaka till 1 över `release` sekunder.
   *
   * Anropas från sequencer varje gång ett trigger-spår firar och detta
   * spår är konfigurerat med `sidechainSourceId === triggerTrack.id`.
   *
   * Tajming: vi använder Tone.Param-API:et som schedulerar i Tone-kontextens
   * tid (sample-accurate). En kort attack (~5 ms) gör att pumpen är
   * känbar utan att klicka.
   */
  applyDuck(timeSec: number, amount: number, releaseSec: number) {
    if (this.disposed) return;
    const amt = Math.max(0, Math.min(1, amount));
    if (amt <= 0) return;
    const attack = 0.005;
    const release = Math.max(0.02, Math.min(2, releaseSec));
    const dipped = 1 - amt;
    const g = this.duckGain.gain;
    // cancelAndHoldAtTime ger ett rent omstart-läge utan klick — om Tone-
    // versionen inte har den, faller vi tillbaka till cancelScheduledValues.
    const cAndH = (g as unknown as { cancelAndHoldAtTime?: (t: number) => void })
      .cancelAndHoldAtTime;
    if (typeof cAndH === 'function') cAndH.call(g, timeSec);
    else g.cancelScheduledValues(timeSec);
    g.linearRampToValueAtTime(dipped, timeSec + attack);
    g.linearRampToValueAtTime(1, timeSec + attack + release);
  }

  /** Voice.connect(chain.getInput()) */
  getInput(): Tone.InputNode {
    return this.input;
  }

  setFx(fx: TrackFx) {
    if (this.disposed) return;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    // --- Bakåtkompat: legacy-fälten används som default om de nya saknas ---
    const delayMix = clamp01(fx.delayMix ?? fx.delay);
    const delayTime = fx.delayTime ?? '8n';
    const delayFeedback = Math.max(0, Math.min(0.95, fx.delayFeedback ?? 0.35));
    const delayMode = fx.delayMode ?? 'pingpong';
    // Reverb: nya fälten har företräde. Legacy reverbLong/Short används som
    // fallback om reverbSend saknas — då migrerar vi även till en typ
    // (long → hall, short → plate). bank.ts:migrateTrack gör samma sak vid
    // ladda så detta är bara en safety-net för in-flight-värden.
    let reverbType: ReverbType = fx.reverbType ?? 'hall';
    let reverbSend = fx.reverbSend;
    if (reverbSend === undefined) {
      const legacyLong = fx.reverbLong ?? fx.reverb;
      const legacyShort = fx.reverbShort ?? 0;
      if (legacyShort > legacyLong) {
        reverbType = 'plate';
        reverbSend = legacyShort;
      } else {
        reverbSend = legacyLong;
      }
    }
    reverbSend = clamp01(reverbSend);
    const reverbPreDelay = Math.max(0, Math.min(0.15, fx.reverbPreDelay ?? 0));
    const sat = clamp01(fx.saturation);
    const chorus = clamp01(fx.chorus ?? 0);
    const chorusRate = Math.max(0.1, Math.min(6, fx.chorusRate ?? 1.5));
    const chorusDepth = clamp01(fx.chorusDepth ?? 0.7);
    const crusher = clamp01(fx.bitcrusher ?? 0);

    // Dry minskar något när saturation eller bitcrusher är uppe så effekten
    // hörs tydligare — men chorus stör inte dry, den fyller på i bredden
    this.drySend.gain.value = 1 - sat * 0.35 - crusher * 0.5;
    this.delaySend.gain.value = delayMix * 0.85;
    this.reverbSend.gain.value = reverbSend * 0.9;
    // Type-router: ramp:a den valda typens gain till 1 och övriga till 0.
    // Kort ramp (~0.05 s) = ingen klick men inte heller hörbart smear vid byte.
    const now = Tone.now();
    for (const type of REVERB_TYPES) {
      const target = type === reverbType ? 1 : 0;
      const g = this.reverbTypeGains[type].gain;
      g.cancelScheduledValues(now);
      g.linearRampToValueAtTime(target, now + 0.05);
    }
    this.satSend.gain.value = sat;
    this.chorusSend.gain.value = chorus;
    this.crusherSend.gain.value = crusher;

    // Saturationens drive-mängd följer också wet
    this.saturation.distortion = 0.15 + sat * 0.75;

    // Chorus rate + depth uppdateras live — Tone.Chorus tillåter ändring
    // av frequency och depth utan att rebuild:a. delayTime är fast 3.5 ms.
    this.chorus.frequency.value = chorusRate;
    this.chorus.depth = chorusDepth;

    // Reverb pre-delay
    this.reverbPreDelay.delayTime.value = reverbPreDelay;

    // Bitcrusher: bits 1–8 där 8 = nästan ren, 1 = total decimering. Mappa
    // wet 0–1 → bits 8 → 2 (1 låter för otäckt vid full mix).
    const bits = Math.max(2, Math.round(8 - crusher * 6));
    this.crusher.bits.value = bits;

    // Delay: uppdatera mode/tid/fb (delayUnit hanterar rebuild vid mode-byte)
    this.delayUnit.setMode(delayMode, delayTime, delayFeedback);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.input.disconnect();
    this.duckGain.disconnect();
    this.panner.disconnect();
    this.drySend.disconnect();
    this.delaySend.disconnect();
    this.reverbSend.disconnect();
    this.reverbPreDelay.disconnect();
    for (const type of REVERB_TYPES) {
      this.reverbTypeGains[type].disconnect();
      this.reverbTypeGains[type].dispose();
    }
    this.satSend.disconnect();
    this.saturation.disconnect();
    this.chorusSend.disconnect();
    this.chorus.disconnect();
    this.crusherSend.disconnect();
    this.crusher.disconnect();
    this.input.dispose();
    this.panner.dispose();
    this.drySend.dispose();
    this.delaySend.dispose();
    this.reverbSend.dispose();
    this.reverbPreDelay.dispose();
    this.satSend.dispose();
    this.saturation.dispose();
    this.chorusSend.dispose();
    this.chorus.dispose();
    this.crusherSend.dispose();
    this.crusher.dispose();
    this.delayUnit.dispose();
    this.duckGain.dispose();
  }
}

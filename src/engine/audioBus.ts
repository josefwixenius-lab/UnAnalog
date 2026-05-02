import * as Tone from 'tone';
import type { DelayMode, DelaySubdivision, TrackFx } from './types';

/**
 * Gemensam master-buss med limiter så det aldrig clippar, oavsett hur många
 * spår som spelar samtidigt eller vilka per-spår volymer användaren ställt in.
 *
 * Signalväg per spår:
 *   voice → input → panner → ┬→ dry ──────────────────────────→ master
 *                            ├→ delay (per-spår-instans, FB+tid) → master
 *                            ├→ reverbShortSend → sharedShortReverb → master
 *                            ├→ reverbLongSend  → sharedLongReverb  → master
 *                            ├→ saturation (parallell) ───────────→ master
 *                            ├→ chorus (per-spår, wet-only) ──────→ master
 *                            └→ bitcrusher (per-spår, wet-only) ──→ master
 *
 * Designval kring resurser:
 * - Reverb är dyrt (genererar IR async) → vi har TVÅ globala instanser:
 *   en kort (~1.2 s) och en lång (~6.5 s). Användaren kan blanda send-nivåer
 *   per spår. Det ger 90 % av flexibiliteten i per-spår-reverb till en bråkdel
 *   av CPU- och laddtidskostnaden.
 * - Delay däremot är billigt — varje spår får egen instans så feedback,
 *   tid och tape-mode kan variera fritt utan att skapa korsfeedback mellan spår.
 * - Chorus och bitcrusher är också per-spår eftersom de är cheap och vi vill
 *   ha unika sound per voice (chorus på lead, bitcrusher på drums osv).
 */

let initialized = false;
let masterInput: Tone.Gain | null = null;
let masterVolume: Tone.Volume | null = null;
let limiter: Tone.Limiter | null = null;
let sharedShortReverb: Tone.Reverb | null = null;
let sharedLongReverb: Tone.Reverb | null = null;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  masterInput = new Tone.Gain(1);
  masterVolume = new Tone.Volume(0);
  limiter = new Tone.Limiter(-0.5);

  // Två globala reverb-instanser. Decay-tid + preDelay valda för att täcka
  // syntwave-spektrumet: kort = "rum/plate-känsla för leads", lång =
  // "snöig pad-svans, FM-84-territory".
  sharedShortReverb = new Tone.Reverb({ decay: 1.2, preDelay: 0.01, wet: 1 });
  sharedLongReverb = new Tone.Reverb({ decay: 6.5, preDelay: 0.04, wet: 1 });
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  sharedShortReverb.generate();
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  sharedLongReverb.generate();

  // Master-summering
  masterInput.connect(masterVolume);
  masterVolume.connect(limiter);
  limiter.toDestination();

  // Reverb-svansarna går in före limitern (post-limiter skulle låta reverb
  // klippa helt självt vid hög wet)
  sharedShortReverb.connect(masterVolume);
  sharedLongReverb.connect(masterVolume);
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
  // Reverb
  private reverbShortSend: Tone.Gain;
  private reverbLongSend: Tone.Gain;
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

  constructor(initial: TrackFx) {
    ensureInit();
    this.input = new Tone.Gain(1);
    this.duckGain = new Tone.Gain(1);
    this.panner = new Tone.Panner(0);
    this.drySend = new Tone.Gain(1);

    this.delaySend = new Tone.Gain(0);
    this.delayUnit = new DelayUnit('pingpong', '8n', 0.35, masterInput!);

    this.reverbShortSend = new Tone.Gain(0);
    this.reverbLongSend = new Tone.Gain(0);

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
    this.panner.connect(this.reverbShortSend);
    this.panner.connect(this.reverbLongSend);
    this.panner.connect(this.satSend);
    this.panner.connect(this.chorusSend);
    this.panner.connect(this.crusherSend);

    // Dry + parallell-effekter → master
    this.drySend.connect(masterInput!);
    this.satSend.connect(this.saturation);
    this.saturation.connect(masterInput!);
    this.chorusSend.connect(this.chorus);
    this.chorus.connect(masterInput!);
    this.crusherSend.connect(this.crusher);
    this.crusher.connect(masterInput!);

    // Delay routas via DelayUnit (output redan kopplad till masterInput)
    this.delaySend.connect(this.delayUnit.getInput());

    // Reverb-sends → globala reverbs
    this.reverbShortSend.connect(sharedShortReverb!);
    this.reverbLongSend.connect(sharedLongReverb!);

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
    const reverbShort = clamp01(fx.reverbShort ?? 0);
    const reverbLong = clamp01(fx.reverbLong ?? fx.reverb);
    const sat = clamp01(fx.saturation);
    const chorus = clamp01(fx.chorus ?? 0);
    const crusher = clamp01(fx.bitcrusher ?? 0);

    // Dry minskar något när saturation eller bitcrusher är uppe så effekten
    // hörs tydligare — men chorus stör inte dry, den fyller på i bredden
    this.drySend.gain.value = 1 - sat * 0.35 - crusher * 0.5;
    this.delaySend.gain.value = delayMix * 0.85;
    this.reverbShortSend.gain.value = reverbShort * 0.9;
    this.reverbLongSend.gain.value = reverbLong * 0.9;
    this.satSend.gain.value = sat;
    this.chorusSend.gain.value = chorus;
    this.crusherSend.gain.value = crusher;

    // Saturationens drive-mängd följer också wet
    this.saturation.distortion = 0.15 + sat * 0.75;

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
    this.reverbShortSend.disconnect();
    this.reverbLongSend.disconnect();
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
    this.reverbShortSend.dispose();
    this.reverbLongSend.dispose();
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

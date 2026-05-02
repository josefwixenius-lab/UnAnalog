export type ScaleName =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'pentatonicMinor'
  | 'pentatonicMajor'
  | 'harmonicMinor'
  | 'blues';

export type PitchNote = {
  scaleDegree: number;
  octaveOffset: number;
};

export type PitchStep = {
  scaleDegree: number;
  octaveOffset: number;
  slide: boolean;
  /**
   * Slide-tid 0–1 där 0 = snapp (kort overlap) och 1 = full step-längd.
   * Påverkar både hur länge internal-voice sustainer och hur stor MIDI-
   * overlap blir mot nästa step (legato → trigga portamento på extern synth).
   * Default 0.5 om saknat.
   */
  slideTime?: number;
  extraNotes?: PitchNote[];
};

export type TrigCondition =
  | 'always'
  | 'p25' | 'p50' | 'p75'
  | '1:2' | '2:2'
  | '1:3' | '2:3' | '3:3'
  | '1:4' | '2:4' | '3:4' | '4:4'
  | 'notPrev' | 'prev'
  | 'fill' | 'notFill';

export type GateStep = {
  active: boolean;
  gate: number;
  probability: number;
  ratchet: number;
  accent: boolean;
  condition: TrigCondition;
  filterLock: number | null;
  velocity: number;
  /** Micro-offset i bråkdelar av ett 16-delssteg (-0.5 till +0.5). 0 = på gridden. */
  nudge: number;
};

export type VoiceKind = 'bass' | 'lead' | 'hats' | 'pad' | 'saw';

/**
 * Mute-grupper för live-arrangemang. Spår kan taggas med A/B/C/D, och
 * Transport har fyra toggle-knappar som tystar alla spår i en grupp på
 * en knapptryckning. Klassiskt scene-arrangemangsverktyg: "i bryggan
 * tystar jag percgruppen", "i refrängen släpper jag på alla igen".
 */
export type MuteGroup = 'A' | 'B' | 'C' | 'D';

/**
 * Spel-riktning per spår — inspirerat av Korg SQ-10 / Behringer BQ-10
 * Mode A/B/C-väljaren. Att kunna köra ett spår baklänges eller ping-pong
 * mot ett annat ger massiv variation utan att man rör en enda step.
 *
 * - `forward`  : 0 → 1 → 2 → … → len-1 → 0  (default)
 * - `reverse`  : len-1 → len-2 → … → 0 → len-1
 * - `pingpong` : 0 → 1 → … → len-1 → len-2 → … → 1 → 0 → 1 → …
 *                Vänder vid kanterna (en full ping-pong tar 2*(len-1) steg).
 * - `random`   : varje step plockas slumpvis i hela längden — kan upprepa
 *                samma index, ger glitchy/oförutsägbar känsla
 * - `brownian` : random-walk (±1 eller står still per step) — tonerna
 *                vandrar runt utan att hoppa, "skälvande melodi"
 */
export type PlayDirection = 'forward' | 'reverse' | 'pingpong' | 'random' | 'brownian';

export type LfoTarget = 'off' | 'volume' | 'filter';
export type LfoShape = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type LfoRate = '16n' | '8n' | '4n' | '2n' | '1n' | '2m' | '4m';

export type TrackLfo = {
  target: LfoTarget;
  rate: LfoRate;
  depth: number;
  shape: LfoShape;
};

/**
 * Delay-tid: musikalisk subdivision. 8n = åttondel, 8n. = punkterad åttondel,
 * 8t = åttondelstriol osv. Default `8n` (klassisk synthwave-delay).
 */
export type DelaySubdivision = '4n' | '8n' | '8n.' | '8t' | '16n' | '16n.' | '16t' | '32n';

/**
 * Delay-läge:
 * - `pingpong` : klassisk stereo ping-pong (default)
 * - `mono`     : enkel mono-feedback-delay (Roland Space Echo-känsla)
 * - `tape`     : pitch-svaj via LFO på delayTime — vintage tape-machine-vibration
 */
export type DelayMode = 'pingpong' | 'mono' | 'tape';

/**
 * Per-spår FX-mix. Värden 0–1 där annat ej anges.
 *
 * Bakåtkompat: `delay` (legacy) tolkas som `delayMix` om det fältet saknas;
 * `reverb` (legacy) tolkas som `reverbLong` om det saknas. Alla nya fält
 * är valfria så gamla sparade banker laddas oförändrat.
 */
export type TrackFx = {
  // --- Legacy + bakåtkompat ---
  delay: number;
  reverb: number;
  saturation: number;

  // --- Delay (per-spår-instans, så feedback + tid + mode kan variera) ---
  /** Wet-mix mot delay-bussen. Default = legacy `delay`. */
  delayMix?: number;
  /** Tid: musikalisk subdivision. Default `8n`. */
  delayTime?: DelaySubdivision;
  /** Feedback-mängd 0–0.95. Default 0.35. Över 0.95 = self-oscillation, undvik. */
  delayFeedback?: number;
  /** Läge: pingpong (default), mono, tape (pitch-svaj). */
  delayMode?: DelayMode;

  // --- Reverb (två globala instanser med sends per spår) ---
  /** Send till kort reverb (~1.2 s decay) — för intimitet, snare-rooms, lead-färg. */
  reverbShort?: number;
  /** Send till lång reverb (~6.5 s decay) — för synthwave-pad-svans, lead-bakgrund. Default = legacy `reverb`. */
  reverbLong?: number;
  /**
   * Reverb pre-delay 0–0.15 s (0–150 ms). Lägger en kort delay mellan
   * dry-signalen och reverb-svansen så transienten hörs ren innan
   * svansen kommer in. Gör leads och pads mer "pro" och mindre mosiga.
   * Gäller båda Short och Long sends för enkelhet. Default 0.
   */
  reverbPreDelay?: number;

  // --- Modulation + krasch ---
  /** Chorus-wet 0–1. Per-spår-instans. Default 0. */
  chorus?: number;
  /** Chorus-rate (LFO-frekvens) 0.1–6 Hz. Default 1.5 Hz. */
  chorusRate?: number;
  /** Chorus-depth 0–1 (modulationsmängd). Default 0.7. */
  chorusDepth?: number;
  /** Bitcrusher-wet 0–1. Per-spår-instans. Default 0. */
  bitcrusher?: number;
};

export type Track = {
  id: string;
  name: string;
  enabled: boolean;
  solo: boolean;
  midiChannel: number;
  /**
   * Valfri per-spår MIDI-utgång. Om `undefined` eller `''` används den globala
   * "MIDI Ut (noter)"-porten. Gör att man kan routa olika spår till olika
   * hårdvaruenheter (t.ex. bass → Model D, lead → JT-4000, perc → E-MU ESI)
   * utan extra MIDI-router i OS.
   */
  midiOutId?: string;
  /**
   * Spel-riktning. Default = `forward` (samma som tidigare beteende).
   * Backward-compat: om fältet saknas i sparad bank tolkas det som forward.
   */
  playDirection?: PlayDirection;
  /**
   * Stereoposition. -1 = hård vänster, 0 = mitt (default), 1 = hård höger.
   * Påverkar dry-, send- och saturation-vägen — så reverb/delay-svans
   * behåller pan-positionen istället för att läcka tillbaka centrerat.
   */
  pan?: number;
  /**
   * Mute-grupp-tagg. Om satt påverkas spåret av Transport-knapparna A/B/C/D.
   * Saknat = ingen grupp (spåret tystas aldrig av mute-grupper, bara av
   * vanliga M-knappen / solo-läget).
   */
  muteGroup?: MuteGroup;
  /**
   * Filter cutoff baseline 0–1. Mappar logaritmiskt till 80 Hz–16 kHz.
   * Om satt skriver det över voice-defaulten (bass=1.6k, lead=3.8k, etc).
   * `filterLock` per step modulerar fortfarande RUNT denna baseline.
   * Saknat = använd voice-default (bakåtkompat).
   */
  filterCutoff?: number;
  /**
   * Filter Q (resonans) 0–1. Mappar linjärt till Q 0.7–12. Default 0
   * (~Q 0.7, neutral). Höga värden gör filter "sjunger" — viktigt för
   * acid-bas och classic synthwave-leads.
   */
  filterResonance?: number;
  /**
   * Per-spår swing override 0–0.6. Saknat = ärv pattern.swing (default-fall).
   * Override-modell (ej additiv) — om satt ersätter den globala swingen
   * helt för detta spår. Klassiskt producent-trick: hihat med 30% swing
   * mot rakt bas → boom-tss-boom-tss-känsla. J Dilla, neo-soul, lo-fi.
   *
   * Notera: Tone.Transport.swing sätts till 0 när per-spår-swing är aktiv.
   * Sequencer-engine beräknar swingOffset manuellt per tick istället, så
   * varje spår kan ha olika värde utan kollision.
   */
  swing?: number;
  /**
   * Sidechain-duck: id på det spår vars triggers ska "pumpa" detta spår.
   * Klassiskt synthwave-trick — bass-spåret pumpar pad-spåret så det
   * kvittrar i takt med basen. Saknat = ingen duck.
   */
  sidechainSourceId?: string;
  /**
   * Hur djupt detta spår dippas vid varje trigger på source-spåret.
   * 0–1 där 0 = ingen pump, 1 = total tystnad i transient-attacken.
   * Default 0. Typisk synthwave: 0.4–0.7.
   */
  sidechainAmount?: number;
  /**
   * Release-tid efter pumpen (sekunder). 0.05–0.5. Default 0.18.
   * Kortare = mer aggressiv pump, längre = breath/svaj-känsla.
   */
  sidechainRelease?: number;
  color: string;
  voice: VoiceKind;
  volumeDb: number;
  pitchSteps: PitchStep[];
  gateSteps: GateStep[];
  rotation: number;
  octaveShift: number;
  lfo: TrackLfo;
  velocityJitter: number;
  fx: TrackFx;
};

export type Pattern = {
  tempo: number;
  rootNote: number;
  baseOctave: number;
  scale: ScaleName;
  swing: number;
  tracks: Track[];
  activeTrackId: string;
  fillActive: boolean;
  /**
   * Vilka mute-grupper som är aktiva (= tystade) just nu. Sparas per
   * pattern så slot-byten kan ha olika scen-mute-tillstånd, vilket är
   * användbart i song-mode (slot A "intro" vs slot B "drop").
   * Saknat eller [] = inga grupper tystade.
   */
  mutedGroups?: MuteGroup[];
};

export type StyleName = 'ambient' | 'acid' | 'berlin' | 'idm' | 'chillout' | 'synthwave' | 'outrun';

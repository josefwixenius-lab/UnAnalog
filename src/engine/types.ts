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
 * Per-spår FX-send. Varje värde är 0–1 (0 = torr, 1 = full effekt).
 * - `delay`: ping-pong, sync:ad 8n
 * - `reverb`: stor hall
 * - `saturation`: mjuk drive / tape
 */
export type TrackFx = {
  delay: number;
  reverb: number;
  saturation: number;
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
};

export type StyleName = 'ambient' | 'acid' | 'berlin' | 'idm' | 'chillout' | 'synthwave' | 'outrun';

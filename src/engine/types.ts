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

export type StyleName = 'ambient' | 'acid' | 'berlin' | 'idm' | 'chillout';

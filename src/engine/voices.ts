import * as Tone from 'tone';
import type { TrackLfo, VoiceKind } from './types';

export type TriggerOptions = {
  filterLock?: number | null;
};

export interface Voice {
  trigger(
    midi: number,
    durationSec: number,
    timeSec: number,
    velocity: number,
    opts?: TriggerOptions,
  ): void;
  setVolume(deltaDb: number): void;
  setLfo(lfo: TrackLfo): void;
  /**
   * Sätt filter cutoff/resonance-baseline. Båda är 0–1 (linjärt input)
   * eller `null`/`undefined` för att använda voice-default. Cutoff mappar
   * logaritmiskt 80 Hz–16 kHz, resonance linjärt Q 0.7–12.
   */
  setFilterBase(cutoff?: number | null, resonance?: number | null): void;
  /** Ansluter voicens output till en extern node (t.ex. TrackFxChain-input). */
  connectOutput(dest: Tone.InputNode): void;
  disconnectOutput(): void;
  dispose(): void;
}

/**
 * Mappa cutoff 0–1 → frekvens 80 Hz – 16 kHz logaritmiskt.
 * Vid 0.5 hamnar man runt 1.1 kHz vilket är musikaliskt rimligt mitt-värde.
 */
function cutoffToHz(cutoff: number): number {
  const c = Math.max(0, Math.min(1, cutoff));
  // 80 * (16000/80)^c = 80 * 200^c
  return 80 * Math.pow(200, c);
}

/** Map resonance 0–1 → Q 0.7–12 (linjärt). 0 = neutral, 1 = sjungande. */
function resonanceToQ(resonance: number): number {
  const r = Math.max(0, Math.min(1, resonance));
  return 0.7 + r * 11.3;
}

type SynthParams = {
  osc: 'sawtooth' | 'triangle' | 'square' | 'sine';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  filterType: 'lowpass' | 'highpass';
  volumeDb: number;
  detune?: number;
};

type PwmParams = {
  /**
   * Modulation-frekvens för pulsbredden i Hz. 0.2–2 = klassisk drönande
   * Juno-pad. 0–0.1 = nästan stilla pulswave (mer som square-wave).
   */
  modulationFrequency: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  volumeDb: number;
};

class LfoRig {
  private lfo: Tone.LFO | null = null;

  constructor(
    private readonly filter: Tone.Filter,
    private readonly volume: Tone.Volume,
    private readonly baseFilterFreq: number,
  ) {}

  apply(next: TrackLfo) {
    this.dispose();
    if (next.target === 'off' || next.depth <= 0) return;

    const shape = next.shape;
    const rate = next.rate;

    if (next.target === 'filter') {
      const min = Math.max(80, this.baseFilterFreq * (1 - next.depth));
      const max = this.baseFilterFreq * (1 + next.depth * 3);
      const l = new Tone.LFO({ type: shape, frequency: rate, min, max }).start();
      l.connect(this.filter.frequency);
      this.lfo = l;
    } else if (next.target === 'volume') {
      const min = -24 * next.depth;
      const max = 0;
      const l = new Tone.LFO({ type: shape, frequency: rate, min, max }).start();
      l.connect(this.volume.volume);
      this.lfo = l;
    }
  }

  dispose() {
    if (this.lfo) {
      this.lfo.disconnect();
      this.lfo.dispose();
      this.lfo = null;
    }
  }
}

function computeLockedFreq(base: number, lock: number, range = 8): number {
  const exp = lock * 2 - 1;
  return Math.max(80, Math.min(16000, base * Math.pow(range, exp)));
}

class SynthVoice implements Voice {
  private synth: Tone.PolySynth;
  private filter: Tone.Filter;
  private volume: Tone.Volume;
  private baseDb: number;
  private baseFilter: number;
  private lfoRig: LfoRig;
  private lastLfo: TrackLfo | null = null;
  private currentDest: Tone.InputNode | null = null;

  constructor(p: SynthParams) {
    this.baseDb = p.volumeDb;
    this.baseFilter = p.filterFreq;
    this.filter = new Tone.Filter(p.filterFreq, p.filterType);
    this.volume = new Tone.Volume(this.baseDb);
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: p.osc },
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
      detune: p.detune ?? 0,
    });
    this.synth.connect(this.filter);
    this.filter.connect(this.volume);
    this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
  }
  connectOutput(dest: Tone.InputNode) {
    if (this.currentDest === dest) return;
    this.disconnectOutput();
    this.volume.connect(dest);
    this.currentDest = dest;
  }
  disconnectOutput() {
    if (this.currentDest) {
      try {
        this.volume.disconnect(this.currentDest as Tone.ToneAudioNode);
      } catch {
        // ignore — mål kan redan vara disposed
      }
      this.currentDest = null;
    }
  }
  trigger(
    midi: number,
    durationSec: number,
    timeSec: number,
    velocity: number,
    opts?: TriggerOptions,
  ) {
    if (opts?.filterLock != null) {
      const locked = computeLockedFreq(this.baseFilter, opts.filterLock, 8);
      this.filter.frequency.cancelScheduledValues(timeSec);
      this.filter.frequency.setValueAtTime(locked, timeSec);
    }
    this.synth.triggerAttackRelease(
      Tone.Frequency(midi, 'midi').toFrequency(),
      durationSec,
      timeSec,
      velocity,
    );
  }
  setVolume(deltaDb: number) {
    this.volume.volume.value = this.baseDb + deltaDb;
  }
  setLfo(lfo: TrackLfo) {
    this.lastLfo = lfo;
    this.lfoRig.apply(lfo);
  }
  setFilterBase(cutoff?: number | null, resonance?: number | null) {
    if (cutoff != null) {
      this.baseFilter = cutoffToHz(cutoff);
      this.filter.frequency.value = this.baseFilter;
      // LfoRig fångar baseFilter i konstruktorn → vi måste bygga om den
      // för att den nya baseline ska gälla för LFO-modulationen.
      this.lfoRig.dispose();
      this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
      if (this.lastLfo) this.lfoRig.apply(this.lastLfo);
    }
    if (resonance != null) {
      this.filter.Q.value = resonanceToQ(resonance);
    }
  }
  dispose() {
    this.lfoRig.dispose();
    this.synth.releaseAll();
    this.disconnectOutput();
    this.synth.disconnect();
    this.synth.dispose();
    this.filter.disconnect();
    this.filter.dispose();
    this.volume.disconnect();
    this.volume.dispose();
  }
}

/**
 * PWM-voice. Bygger på Tone.PWMOscillator där pulsbredden moduleras av en
 * intern LFO (modulationFrequency). 0.4–2 Hz = den klassiska drömska
 * Juno/Polysix-padden; 0 Hz = nästan ren square (kan låta torrt).
 *
 * Implementerad som monofonisk wrapper med vår egen filter+volume+LFO-kedja
 * istället för PolySynth — Tone.PolySynth har strul med PWMOscillator vid
 * type-checking i v15 och vi vill ha full kontroll över envelopen ändå.
 */
class PwmVoice implements Voice {
  private osc: Tone.PWMOscillator;
  private env: Tone.AmplitudeEnvelope;
  private filter: Tone.Filter;
  private volume: Tone.Volume;
  private baseDb: number;
  private baseFilter: number;
  private lfoRig: LfoRig;
  private lastLfo: TrackLfo | null = null;
  private currentDest: Tone.InputNode | null = null;
  private isPlaying = false;

  constructor(p: PwmParams) {
    this.baseDb = p.volumeDb;
    this.baseFilter = p.filterFreq;
    this.osc = new Tone.PWMOscillator({
      frequency: 440,
      modulationFrequency: p.modulationFrequency,
    });
    this.env = new Tone.AmplitudeEnvelope({
      attack: p.attack,
      decay: p.decay,
      sustain: p.sustain,
      release: p.release,
    });
    this.filter = new Tone.Filter(p.filterFreq, 'lowpass');
    this.volume = new Tone.Volume(this.baseDb);
    this.osc.connect(this.env);
    this.env.connect(this.filter);
    this.filter.connect(this.volume);
    this.osc.start();
    this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
  }
  connectOutput(dest: Tone.InputNode) {
    if (this.currentDest === dest) return;
    this.disconnectOutput();
    this.volume.connect(dest);
    this.currentDest = dest;
  }
  disconnectOutput() {
    if (this.currentDest) {
      try {
        this.volume.disconnect(this.currentDest as Tone.ToneAudioNode);
      } catch {
        // ignore
      }
      this.currentDest = null;
    }
  }
  trigger(
    midi: number,
    durationSec: number,
    timeSec: number,
    velocity: number,
    opts?: TriggerOptions,
  ) {
    if (opts?.filterLock != null) {
      const locked = computeLockedFreq(this.baseFilter, opts.filterLock, 8);
      this.filter.frequency.cancelScheduledValues(timeSec);
      this.filter.frequency.setValueAtTime(locked, timeSec);
    }
    // Sätt frekvens vid trigger-tiden så vi inte glider mellan steg
    const freq = Tone.Frequency(midi, 'midi').toFrequency();
    this.osc.frequency.setValueAtTime(freq, timeSec);
    // Velocity skalas in i envelopens max — Tone.AmplitudeEnvelope har inget
    // velocity-koncept, så vi modulerar volume kortvarigt via env-trigger.
    // För enkelhet: full envelope-trigger; velocity hanteras via volume-pre-set.
    // Inget perfekt men låter rimligt på en pad/lead.
    const velDb = -24 * (1 - Math.max(0.05, Math.min(1, velocity)));
    this.volume.volume.setValueAtTime(this.baseDb + velDb, timeSec);
    this.env.triggerAttackRelease(durationSec, timeSec);
    this.isPlaying = true;
  }
  setVolume(deltaDb: number) {
    this.volume.volume.value = this.baseDb + deltaDb;
  }
  setLfo(lfo: TrackLfo) {
    this.lastLfo = lfo;
    this.lfoRig.apply(lfo);
  }
  setFilterBase(cutoff?: number | null, resonance?: number | null) {
    if (cutoff != null) {
      this.baseFilter = cutoffToHz(cutoff);
      this.filter.frequency.value = this.baseFilter;
      this.lfoRig.dispose();
      this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
      if (this.lastLfo) this.lfoRig.apply(this.lastLfo);
    }
    if (resonance != null) {
      this.filter.Q.value = resonanceToQ(resonance);
    }
  }
  dispose() {
    this.lfoRig.dispose();
    this.disconnectOutput();
    if (this.isPlaying) this.env.triggerRelease();
    this.osc.stop();
    this.osc.disconnect();
    this.env.disconnect();
    this.filter.disconnect();
    this.volume.disconnect();
    this.osc.dispose();
    this.env.dispose();
    this.filter.dispose();
    this.volume.dispose();
  }
}

type NoiseParams = {
  hpf: number;
  attack: number;
  decay: number;
  release: number;
  volumeDb: number;
};

class NoiseVoice implements Voice {
  private synth: Tone.NoiseSynth;
  private filter: Tone.Filter;
  private volume: Tone.Volume;
  private baseDb: number;
  private baseFilter: number;
  private lfoRig: LfoRig;
  private lastLfo: TrackLfo | null = null;
  private currentDest: Tone.InputNode | null = null;

  constructor(p: NoiseParams) {
    this.baseDb = p.volumeDb;
    this.baseFilter = p.hpf;
    this.filter = new Tone.Filter(p.hpf, 'highpass');
    this.volume = new Tone.Volume(this.baseDb);
    this.synth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: p.attack, decay: p.decay, sustain: 0, release: p.release },
    });
    this.synth.connect(this.filter);
    this.filter.connect(this.volume);
    this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
  }
  connectOutput(dest: Tone.InputNode) {
    if (this.currentDest === dest) return;
    this.disconnectOutput();
    this.volume.connect(dest);
    this.currentDest = dest;
  }
  disconnectOutput() {
    if (this.currentDest) {
      try {
        this.volume.disconnect(this.currentDest as Tone.ToneAudioNode);
      } catch {
        // ignore
      }
      this.currentDest = null;
    }
  }
  trigger(
    _midi: number,
    durationSec: number,
    timeSec: number,
    velocity: number,
    opts?: TriggerOptions,
  ) {
    if (opts?.filterLock != null) {
      const locked = computeLockedFreq(this.baseFilter, opts.filterLock, 4);
      this.filter.frequency.cancelScheduledValues(timeSec);
      this.filter.frequency.setValueAtTime(locked, timeSec);
    }
    this.synth.triggerAttackRelease(durationSec, timeSec, velocity);
  }
  setVolume(deltaDb: number) {
    this.volume.volume.value = this.baseDb + deltaDb;
  }
  setLfo(lfo: TrackLfo) {
    this.lastLfo = lfo;
    this.lfoRig.apply(lfo);
  }
  setFilterBase(cutoff?: number | null, resonance?: number | null) {
    if (cutoff != null) {
      // NoiseVoice använder highpass — cutoff styr brusets tonkaraktär.
      // Mappar samma 80–16k men den användbara zonen är 2k–12k för hihat.
      this.baseFilter = cutoffToHz(cutoff);
      this.filter.frequency.value = this.baseFilter;
      this.lfoRig.dispose();
      this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
      if (this.lastLfo) this.lfoRig.apply(this.lastLfo);
    }
    if (resonance != null) {
      this.filter.Q.value = resonanceToQ(resonance);
    }
  }
  dispose() {
    this.lfoRig.dispose();
    this.disconnectOutput();
    this.synth.disconnect();
    this.synth.dispose();
    this.filter.disconnect();
    this.filter.dispose();
    this.volume.disconnect();
    this.volume.dispose();
  }
}

export function createVoice(kind: VoiceKind): Voice {
  switch (kind) {
    case 'bass':
      return new SynthVoice({
        osc: 'sawtooth',
        attack: 0.005,
        decay: 0.12,
        sustain: 0.2,
        release: 0.18,
        filterFreq: 1600,
        filterType: 'lowpass',
        volumeDb: -9,
      });
    case 'lead':
      return new SynthVoice({
        osc: 'sawtooth',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.45,
        release: 0.55,
        filterFreq: 3800,
        filterType: 'lowpass',
        volumeDb: -12,
        detune: 6,
      });
    case 'hats':
      return new NoiseVoice({
        hpf: 8000,
        attack: 0.001,
        decay: 0.04,
        release: 0.04,
        volumeDb: -18,
      });
    case 'pad':
      return new SynthVoice({
        osc: 'triangle',
        attack: 0.04,
        decay: 0.3,
        sustain: 0.8,
        release: 0.9,
        filterFreq: 2400,
        filterType: 'lowpass',
        volumeDb: -10,
      });
    case 'pwm':
      return new PwmVoice({
        // 0.6 Hz = klassisk drömlik wobble — varken aggressiv eller stillastående
        modulationFrequency: 0.6,
        attack: 0.04,
        decay: 0.25,
        sustain: 0.7,
        release: 0.7,
        filterFreq: 2800,
        volumeDb: -10,
      });
    case 'saw':
    default:
      return new SynthVoice({
        osc: 'sawtooth',
        attack: 0.005,
        decay: 0.15,
        sustain: 0.3,
        release: 0.4,
        filterFreq: 2500,
        filterType: 'lowpass',
        volumeDb: -12,
      });
  }
}

export const VOICE_LABELS: Record<VoiceKind, string> = {
  bass: 'Bas',
  lead: 'Lead',
  hats: 'Hats',
  pad: 'Pad',
  saw: 'Saw',
  pwm: 'PWM',
};

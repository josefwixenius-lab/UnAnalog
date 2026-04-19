import * as Tone from 'tone';
class LfoRig {
    constructor(filter, volume, baseFilterFreq) {
        Object.defineProperty(this, "filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: filter
        });
        Object.defineProperty(this, "volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: volume
        });
        Object.defineProperty(this, "baseFilterFreq", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseFilterFreq
        });
        Object.defineProperty(this, "lfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    apply(next) {
        this.dispose();
        if (next.target === 'off' || next.depth <= 0)
            return;
        const shape = next.shape;
        const rate = next.rate;
        if (next.target === 'filter') {
            const min = Math.max(80, this.baseFilterFreq * (1 - next.depth));
            const max = this.baseFilterFreq * (1 + next.depth * 3);
            const l = new Tone.LFO({ type: shape, frequency: rate, min, max }).start();
            l.connect(this.filter.frequency);
            this.lfo = l;
        }
        else if (next.target === 'volume') {
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
function computeLockedFreq(base, lock, range = 8) {
    const exp = lock * 2 - 1;
    return Math.max(80, Math.min(16000, base * Math.pow(range, exp)));
}
class SynthVoice {
    constructor(p) {
        Object.defineProperty(this, "synth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseDb", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseFilter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lfoRig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
        this.volume.toDestination();
        this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
    }
    trigger(midi, durationSec, timeSec, velocity, opts) {
        if (opts?.filterLock != null) {
            const locked = computeLockedFreq(this.baseFilter, opts.filterLock, 8);
            this.filter.frequency.cancelScheduledValues(timeSec);
            this.filter.frequency.setValueAtTime(locked, timeSec);
        }
        this.synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), durationSec, timeSec, velocity);
    }
    setVolume(deltaDb) {
        this.volume.volume.value = this.baseDb + deltaDb;
    }
    setLfo(lfo) {
        this.lfoRig.apply(lfo);
    }
    dispose() {
        this.lfoRig.dispose();
        this.synth.releaseAll();
        this.synth.disconnect();
        this.synth.dispose();
        this.filter.disconnect();
        this.filter.dispose();
        this.volume.disconnect();
        this.volume.dispose();
    }
}
class NoiseVoice {
    constructor(p) {
        Object.defineProperty(this, "synth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "filter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "volume", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseDb", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseFilter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lfoRig", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
        this.volume.toDestination();
        this.lfoRig = new LfoRig(this.filter, this.volume, this.baseFilter);
    }
    trigger(_midi, durationSec, timeSec, velocity, opts) {
        if (opts?.filterLock != null) {
            const locked = computeLockedFreq(this.baseFilter, opts.filterLock, 4);
            this.filter.frequency.cancelScheduledValues(timeSec);
            this.filter.frequency.setValueAtTime(locked, timeSec);
        }
        this.synth.triggerAttackRelease(durationSec, timeSec, velocity);
    }
    setVolume(deltaDb) {
        this.volume.volume.value = this.baseDb + deltaDb;
    }
    setLfo(lfo) {
        this.lfoRig.apply(lfo);
    }
    dispose() {
        this.lfoRig.dispose();
        this.synth.disconnect();
        this.synth.dispose();
        this.filter.disconnect();
        this.filter.dispose();
        this.volume.disconnect();
        this.volume.dispose();
    }
}
export function createVoice(kind) {
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
export const VOICE_LABELS = {
    bass: 'Bas',
    lead: 'Lead',
    hats: 'Hats',
    pad: 'Pad',
    saw: 'Saw',
};

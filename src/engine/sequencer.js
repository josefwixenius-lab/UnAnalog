import * as Tone from 'tone';
import { degreeToMidi } from './scales';
import { createVoice } from './voices';
function evalCondition(c, rt, fill) {
    switch (c) {
        case 'always': return true;
        case 'p25': return Math.random() < 0.25;
        case 'p50': return Math.random() < 0.5;
        case 'p75': return Math.random() < 0.75;
        case '1:2': return rt.cycleCount % 2 === 0;
        case '2:2': return rt.cycleCount % 2 === 1;
        case '1:3': return rt.cycleCount % 3 === 0;
        case '2:3': return rt.cycleCount % 3 === 1;
        case '3:3': return rt.cycleCount % 3 === 2;
        case '1:4': return rt.cycleCount % 4 === 0;
        case '2:4': return rt.cycleCount % 4 === 1;
        case '3:4': return rt.cycleCount % 4 === 2;
        case '4:4': return rt.cycleCount % 4 === 3;
        case 'notPrev': return !rt.prevFired;
        case 'prev': return rt.prevFired;
        case 'fill': return fill;
        case 'notFill': return !fill;
    }
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function computeVelocity(baseVelocity, accent, jitter) {
    let v = baseVelocity;
    if (accent)
        v = Math.min(1, v + 0.2);
    if (jitter > 0) {
        const r = (Math.random() * 2 - 1) * jitter;
        v = v * (1 + r);
    }
    return clamp(v, 0.05, 1);
}
export class Sequencer {
    constructor(initial, cb = {}) {
        Object.defineProperty(this, "pattern", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "scheduleId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "clockScheduleId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "cb", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "audible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "runtimes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "voices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "tickCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "clockEnabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "externalTempo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.pattern = initial;
        this.cb = cb;
        this.syncRuntimes(initial);
    }
    syncRuntimes(p) {
        const next = new Map();
        for (const t of p.tracks) {
            next.set(t.id, this.runtimes.get(t.id) ?? {
                pitchIdx: 0,
                gateIdx: 0,
                cycleCount: 0,
                prevFired: false,
            });
        }
        this.runtimes = next;
    }
    syncVoices(p) {
        if (!this.audible)
            return;
        const seen = new Set();
        for (const t of p.tracks) {
            seen.add(t.id);
            const existing = this.voices.get(t.id);
            if (!existing || existing.kind !== t.voice) {
                existing?.voice.dispose();
                const voice = createVoice(t.voice);
                voice.setVolume(t.volumeDb);
                voice.setLfo(t.lfo);
                this.voices.set(t.id, { kind: t.voice, voice });
            }
            else {
                existing.voice.setVolume(t.volumeDb);
                existing.voice.setLfo(t.lfo);
            }
        }
        for (const [id, v] of this.voices) {
            if (!seen.has(id)) {
                v.voice.dispose();
                this.voices.delete(id);
            }
        }
    }
    disposeAllVoices() {
        for (const v of this.voices.values())
            v.voice.dispose();
        this.voices.clear();
    }
    setPattern(p) {
        this.pattern = p;
        this.syncRuntimes(p);
        this.syncVoices(p);
        const tt = Tone.getTransport();
        tt.bpm.value = this.externalTempo ?? p.tempo;
        tt.swing = p.swing;
        tt.swingSubdivision = '16n';
    }
    /**
     * Sätter extern tempo-override. Så länge den är satt ignoreras pattern.tempo
     * och Tone.Transport drivs av det uppmätta externa tempot.
     */
    setExternalTempo(bpm) {
        this.externalTempo = bpm;
        if (bpm !== null) {
            Tone.getTransport().bpm.value = bpm;
        }
        else {
            // Tillbaka till intern — återställ från patterns lagrade tempo
            Tone.getTransport().bpm.value = this.pattern.tempo;
        }
    }
    setCallbacks(cb) {
        this.cb = cb;
    }
    setClockEnabled(enabled) {
        this.clockEnabled = enabled;
        if (!enabled && this.clockScheduleId !== null) {
            Tone.getTransport().clear(this.clockScheduleId);
            this.clockScheduleId = null;
        }
        else if (enabled && this.scheduleId !== null && this.clockScheduleId === null) {
            this.clockScheduleId = Tone.getTransport().scheduleRepeat((time) => this.cb.onClock?.('clock', time), '96n');
        }
    }
    async start() {
        await Tone.start();
        this.syncVoices(this.pattern);
        const tt = Tone.getTransport();
        tt.bpm.value = this.externalTempo ?? this.pattern.tempo;
        tt.swing = this.pattern.swing;
        tt.swingSubdivision = '16n';
        this.resetRuntimes();
        this.tickCount = 0;
        if (this.scheduleId === null) {
            this.scheduleId = tt.scheduleRepeat((time) => this.tick(time), '16n');
        }
        if (this.clockEnabled && this.clockScheduleId === null) {
            this.clockScheduleId = tt.scheduleRepeat((time) => this.cb.onClock?.('clock', time), '96n');
        }
        if (this.clockEnabled) {
            this.cb.onClock?.('start', Tone.now());
        }
        tt.start();
    }
    stop() {
        const tt = Tone.getTransport();
        tt.stop();
        if (this.scheduleId !== null) {
            tt.clear(this.scheduleId);
            this.scheduleId = null;
        }
        if (this.clockScheduleId !== null) {
            tt.clear(this.clockScheduleId);
            this.clockScheduleId = null;
        }
        if (this.clockEnabled) {
            this.cb.onClock?.('stop', Tone.now());
        }
        this.resetRuntimes();
        this.tickCount = 0;
        for (const t of this.pattern.tracks) {
            this.cb.onStep?.(t.id, -1, -1);
        }
    }
    setAudible(audible) {
        this.audible = audible;
        if (audible) {
            this.syncVoices(this.pattern);
        }
        else {
            this.disposeAllVoices();
        }
    }
    resetRuntimes() {
        for (const rt of this.runtimes.values()) {
            rt.pitchIdx = 0;
            rt.gateIdx = 0;
            rt.cycleCount = 0;
            rt.prevFired = false;
        }
    }
    tick(time) {
        if (this.tickCount % 16 === 0) {
            this.cb.onBar?.();
        }
        this.tickCount++;
        const p = this.pattern;
        const stepSec = Tone.Time('16n').toSeconds();
        const anySolo = p.tracks.some((t) => t.solo);
        for (const t of p.tracks) {
            const rt = this.runtimes.get(t.id);
            if (!rt)
                continue;
            const gate = t.gateSteps[rt.gateIdx];
            const pitch = t.pitchSteps[rt.pitchIdx];
            const trackAudible = t.enabled && (!anySolo || t.solo);
            let fired = false;
            if (gate && pitch && gate.active && trackAudible) {
                const condPass = evalCondition(gate.condition, rt, p.fillActive);
                const probPass = Math.random() <= gate.probability;
                if (condPass && probPass) {
                    fired = true;
                    const allNotes = [
                        { scaleDegree: pitch.scaleDegree, octaveOffset: pitch.octaveOffset },
                        ...(pitch.extraNotes ?? []),
                    ];
                    const midis = allNotes.map((n) => degreeToMidi(p.rootNote, p.baseOctave + t.octaveShift, p.scale, n.scaleDegree, n.octaveOffset));
                    const ratchet = Math.max(1, Math.min(4, gate.ratchet));
                    const subStep = stepSec / ratchet;
                    const dur = Math.max(0.01, subStep * gate.gate);
                    const baseVel = typeof gate.velocity === 'number' ? gate.velocity : 0.8;
                    const jitter = typeof t.velocityJitter === 'number' ? t.velocityJitter : 0;
                    const nudgeFrac = clamp(typeof gate.nudge === 'number' ? gate.nudge : 0, -0.5, 0.5);
                    const nudgeSec = nudgeFrac * stepSec;
                    const voice = this.voices.get(t.id);
                    const isNoise = t.voice === 'hats';
                    for (let r = 0; r < ratchet; r++) {
                        // Tone har lookahead (~100 ms) så negativ nudge funkar upp till ±50% av steget
                        // vid rimliga tempon. Vid mycket höga BPM kan negativ nudge klippas av Tone.
                        const t0 = time + nudgeSec + r * subStep;
                        const midisToPlay = isNoise ? [midis[0]] : midis;
                        const velocity = computeVelocity(baseVel, gate.accent, jitter);
                        for (const midi of midisToPlay) {
                            voice?.voice.trigger(midi, dur, t0, velocity, { filterLock: gate.filterLock });
                            this.cb.onNote?.({
                                trackId: t.id,
                                timeSec: t0,
                                midi,
                                durationSec: dur,
                                velocity,
                                midiChannel: t.midiChannel,
                                slide: pitch.slide,
                            });
                        }
                    }
                }
            }
            rt.prevFired = fired;
            const trackId = t.id;
            const pIdx = rt.pitchIdx;
            const gIdx = rt.gateIdx;
            Tone.getDraw().schedule(() => {
                this.cb.onStep?.(trackId, pIdx, gIdx);
            }, time);
            const nextPitch = (rt.pitchIdx + 1) % Math.max(1, t.pitchSteps.length);
            const nextGate = (rt.gateIdx + 1) % Math.max(1, t.gateSteps.length);
            if (nextGate === 0)
                rt.cycleCount++;
            rt.pitchIdx = nextPitch;
            rt.gateIdx = nextGate;
        }
    }
}

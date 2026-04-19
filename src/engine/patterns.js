import { midiToNearestDegree, scaleLength } from './scales';
let _tid = 0;
function newTrackId() {
    return `t${++_tid}-${Math.random().toString(36).slice(2, 7)}`;
}
export function makePitchStep(degree = 0) {
    return { scaleDegree: degree, octaveOffset: 0, slide: false };
}
export function makeGateStep(active = false) {
    return {
        active,
        gate: 0.5,
        probability: 1,
        ratchet: 1,
        accent: false,
        condition: 'always',
        filterLock: null,
        velocity: 0.8,
        nudge: 0,
    };
}
export function makeTrack(opts) {
    const len = opts.length ?? 16;
    return {
        id: newTrackId(),
        name: opts.name,
        enabled: true,
        solo: false,
        midiChannel: opts.midiChannel,
        color: opts.color,
        voice: opts.voice,
        volumeDb: 0,
        pitchSteps: Array.from({ length: len }, () => makePitchStep(0)),
        gateSteps: Array.from({ length: len }, () => makeGateStep(false)),
        rotation: 0,
        octaveShift: 0,
        lfo: { target: 'off', rate: '4n', depth: 0.3, shape: 'sine' },
        velocityJitter: 0,
    };
}
export function emptyPattern() {
    const tracks = [
        makeTrack({ name: 'Bas', color: '#7ee7c1', midiChannel: 1, voice: 'bass' }),
        makeTrack({ name: 'Lead', color: '#f7c873', midiChannel: 2, voice: 'lead' }),
        makeTrack({ name: 'Hats', color: '#ff6b6b', midiChannel: 10, voice: 'hats' }),
        makeTrack({ name: 'Ackord', color: '#b388ff', midiChannel: 3, voice: 'pad' }),
    ];
    return {
        tempo: 110,
        rootNote: 0,
        baseOctave: 3,
        scale: 'minor',
        swing: 0,
        tracks,
        activeTrackId: tracks[0].id,
        fillActive: false,
    };
}
export function addTrack(p) {
    const palette = ['#7ee7c1', '#f7c873', '#ff6b6b', '#b388ff', '#6ab7ff', '#ffa66a', '#a0e060'];
    const color = palette[p.tracks.length % palette.length];
    const newTrack = makeTrack({
        name: `Spår ${p.tracks.length + 1}`,
        color,
        midiChannel: 1,
        voice: 'saw',
    });
    return { ...p, tracks: [...p.tracks, newTrack] };
}
export function removeTrack(p, id) {
    if (p.tracks.length <= 1)
        return p;
    const tracks = p.tracks.filter((t) => t.id !== id);
    const activeTrackId = p.activeTrackId === id ? tracks[0].id : p.activeTrackId;
    return { ...p, tracks, activeTrackId };
}
export function updateTrackById(p, id, patch) {
    return {
        ...p,
        tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    };
}
export function updateActiveTrack(p, fn) {
    return {
        ...p,
        tracks: p.tracks.map((t) => (t.id === p.activeTrackId ? fn(t) : t)),
    };
}
export function resizeActiveTrack(p, pitchLen, gateLen) {
    return updateActiveTrack(p, (t) => ({
        ...t,
        pitchSteps: Array.from({ length: pitchLen }, (_, i) => t.pitchSteps[i] ?? makePitchStep(0)),
        gateSteps: Array.from({ length: gateLen }, (_, i) => t.gateSteps[i] ?? makeGateStep(false)),
    }));
}
export function euclidean(pulses, steps) {
    const result = new Array(steps).fill(false);
    if (pulses <= 0 || steps <= 0)
        return result;
    if (pulses >= steps)
        return result.fill(true);
    let bucket = 0;
    for (let i = 0; i < steps; i++) {
        bucket += pulses;
        if (bucket >= steps) {
            bucket -= steps;
            result[i] = true;
        }
    }
    const firstHit = result.indexOf(true);
    if (firstHit > 0) {
        return [...result.slice(firstHit), ...result.slice(0, firstHit)];
    }
    return result;
}
export function mutateActiveTrack(p, amount) {
    const len = scaleLength(p.scale);
    return updateActiveTrack(p, (t) => ({
        ...t,
        pitchSteps: t.pitchSteps.map((s) => Math.random() < amount
            ? {
                ...s,
                scaleDegree: Math.floor(Math.random() * len),
                octaveOffset: Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : s.octaveOffset,
            }
            : s),
        gateSteps: t.gateSteps.map((g) => Math.random() < amount * 0.5 ? { ...g, active: !g.active } : g),
    }));
}
export function randomizeActivePitch(p) {
    const len = scaleLength(p.scale);
    return updateActiveTrack(p, (t) => ({
        ...t,
        pitchSteps: t.pitchSteps.map((s) => ({
            ...s,
            scaleDegree: Math.floor(Math.random() * len),
            octaveOffset: Math.random() < 0.12 ? (Math.random() < 0.5 ? -1 : 1) : 0,
        })),
    }));
}
export function clearActiveGates(p) {
    return updateActiveTrack(p, (t) => ({
        ...t,
        gateSteps: t.gateSteps.map((g) => ({ ...g, active: false })),
    }));
}
export function allActiveGates(p) {
    return updateActiveTrack(p, (t) => ({
        ...t,
        gateSteps: t.gateSteps.map((g) => ({ ...g, active: true })),
    }));
}
export function applyEuclideanToActive(p, pulses) {
    return updateActiveTrack(p, (t) => {
        const pulsePattern = euclidean(pulses, t.gateSteps.length);
        return {
            ...t,
            gateSteps: t.gateSteps.map((g, i) => ({ ...g, active: pulsePattern[i] })),
        };
    });
}
export function rotateActiveTrack(p, offset) {
    return updateActiveTrack(p, (t) => {
        const rot = (arr) => {
            if (arr.length === 0)
                return arr;
            const n = ((offset % arr.length) + arr.length) % arr.length;
            return [...arr.slice(arr.length - n), ...arr.slice(0, arr.length - n)];
        };
        return {
            ...t,
            pitchSteps: rot(t.pitchSteps),
            gateSteps: rot(t.gateSteps),
            rotation: t.rotation + offset,
        };
    });
}
export function resetRotationActiveTrack(p) {
    return updateActiveTrack(p, (t) => {
        if (t.rotation === 0)
            return t;
        const back = -t.rotation;
        const rot = (arr) => {
            if (arr.length === 0)
                return arr;
            const n = ((back % arr.length) + arr.length) % arr.length;
            return [...arr.slice(arr.length - n), ...arr.slice(0, arr.length - n)];
        };
        return {
            ...t,
            pitchSteps: rot(t.pitchSteps),
            gateSteps: rot(t.gateSteps),
            rotation: 0,
        };
    });
}
export function shiftOctaveActiveTrack(p, delta) {
    return updateActiveTrack(p, (t) => ({
        ...t,
        octaveShift: Math.max(-4, Math.min(4, t.octaveShift + delta)),
    }));
}
export function resetOctaveActiveTrack(p) {
    return updateActiveTrack(p, (t) => (t.octaveShift === 0 ? t : { ...t, octaveShift: 0 }));
}
/**
 * Slumpar nudge på alla steg i aktivt spår till ett värde i intervallet ±amount.
 * amount = 0.1 ger ±10% av ett 16-delssteg. Påverkar även passiva steg så att
 * humaniseringen följer med när användaren aktiverar stegen senare.
 */
export function humanizeNudgeActive(p, amount) {
    const a = Math.max(0, Math.min(0.5, amount));
    if (a === 0)
        return resetNudgeActive(p);
    return updateActiveTrack(p, (t) => ({
        ...t,
        gateSteps: t.gateSteps.map((g) => ({
            ...g,
            nudge: (Math.random() * 2 - 1) * a,
        })),
    }));
}
export function resetNudgeActive(p) {
    return updateActiveTrack(p, (t) => ({
        ...t,
        gateSteps: t.gateSteps.map((g) => (g.nudge === 0 ? g : { ...g, nudge: 0 })),
    }));
}
function arrangeByDirection(notes, dir) {
    const n = notes.length;
    if (n === 0)
        return [];
    if (n === 1)
        return [notes[0]];
    switch (dir) {
        case 'up':
            return notes.slice();
        case 'down':
            return notes.slice().reverse();
        case 'random': {
            const out = notes.slice();
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [out[i], out[j]] = [out[j], out[i]];
            }
            return out;
        }
        case 'updown': {
            const down = notes.slice().reverse();
            return [...notes, ...down];
        }
        case 'pingpong': {
            if (n === 2)
                return notes.slice();
            const middleDown = notes.slice(1, -1).reverse();
            return [...notes, ...middleDown];
        }
        case 'stack':
        case 'sequence':
            return notes.slice();
    }
}
export function applyChordToActive(p, midiNotes, direction) {
    if (midiNotes.length === 0)
        return p;
    // För 'sequence' bevaras ordning och ev. dubletter (om man spelar samma ton
    // flera gånger räknas varje not-on som ett eget steg). Övriga riktningar
    // tar unika toner och sorterar efter tonhöjd.
    const source = direction === 'sequence' ? midiNotes : Array.from(new Set(midiNotes));
    const withPitch = source.map((m) => ({
        midi: m,
        ...midiToNearestDegree(m, p.rootNote, p.baseOctave, p.scale),
    }));
    if (direction !== 'sequence') {
        withPitch.sort((a, b) => a.midi - b.midi);
    }
    if (direction === 'stack') {
        const [first, ...rest] = withPitch;
        return updateActiveTrack(p, (t) => ({
            ...t,
            pitchSteps: [
                {
                    scaleDegree: first.scaleDegree,
                    octaveOffset: first.octaveOffset,
                    slide: false,
                    extraNotes: rest.map((n) => ({
                        scaleDegree: n.scaleDegree,
                        octaveOffset: n.octaveOffset,
                    })),
                },
                ...Array.from({ length: Math.max(0, t.pitchSteps.length - 1) }, (_, i) => {
                    const existing = t.pitchSteps[i + 1];
                    return existing ?? makePitchStep(0);
                }),
            ],
            gateSteps: t.gateSteps.map((g, i) => i === 0 ? { ...g, active: true } : g),
            rotation: 0,
        }));
    }
    const sequence = arrangeByDirection(withPitch, direction);
    const len = Math.max(1, sequence.length);
    return updateActiveTrack(p, (t) => ({
        ...t,
        pitchSteps: Array.from({ length: len }, (_, i) => {
            const src = sequence[i] ?? sequence[sequence.length - 1];
            return { scaleDegree: src.scaleDegree, octaveOffset: src.octaveOffset, slide: false };
        }),
        gateSteps: Array.from({ length: len }, (_, i) => {
            const existing = t.gateSteps[i];
            return {
                active: true,
                gate: existing?.gate ?? 0.5,
                probability: existing?.probability ?? 1,
                ratchet: existing?.ratchet ?? 1,
                accent: existing?.accent ?? false,
                condition: existing?.condition ?? 'always',
                filterLock: existing?.filterLock ?? null,
                velocity: existing?.velocity ?? 0.8,
                nudge: existing?.nudge ?? 0,
            };
        }),
        rotation: 0,
    }));
}
function pick(arr, i) {
    return arr[((i % arr.length) + arr.length) % arr.length];
}
export function applyStyleToActive(p, style) {
    switch (style) {
        case 'ambient': {
            const degrees = [0, 2, 4, 3, 0, 1, 4, 2];
            return updateActiveTrack(p, (t) => ({
                ...t,
                pitchSteps: t.pitchSteps.map((s, i) => ({
                    ...s,
                    scaleDegree: pick(degrees, i),
                    octaveOffset: i % 4 === 2 ? 1 : 0,
                    slide: false,
                })),
                gateSteps: t.gateSteps.map((g, i) => ({
                    ...g,
                    active: i % 3 === 0 || i % 7 === 0,
                    gate: 0.9,
                    probability: 0.75,
                    ratchet: 1,
                    accent: false,
                    condition: 'always',
                })),
            }));
        }
        case 'acid': {
            const pulses = (gl) => euclidean(Math.min(11, gl), gl);
            const degrees = [0, 0, 3, 0, 5, 0, 2, 0, 4, 0, 3, 5, 0, 2, 0, 6];
            return updateActiveTrack(p, (t) => {
                const e = pulses(t.gateSteps.length);
                return {
                    ...t,
                    pitchSteps: t.pitchSteps.map((s, i) => ({
                        ...s,
                        scaleDegree: pick(degrees, i),
                        octaveOffset: i % 5 === 4 ? 1 : 0,
                        slide: i % 4 === 3,
                    })),
                    gateSteps: t.gateSteps.map((g, i) => ({
                        ...g,
                        active: e[i],
                        gate: 0.4,
                        probability: 0.95,
                        ratchet: i % 7 === 6 ? 3 : 1,
                        accent: i % 4 === 0,
                        condition: i % 8 === 7 ? '3:4' : 'always',
                    })),
                };
            });
        }
        case 'berlin': {
            const degrees = [0, 4, 2, 5, 0, 4, 2, 7];
            const octaves = [0, 0, 0, 0, 1, 0, 0, -1];
            return updateActiveTrack(p, (t) => ({
                ...t,
                pitchSteps: t.pitchSteps.map((s, i) => ({
                    ...s,
                    scaleDegree: pick(degrees, i),
                    octaveOffset: pick(octaves, i),
                    slide: false,
                })),
                gateSteps: t.gateSteps.map((g) => ({
                    ...g,
                    active: true,
                    gate: 0.5,
                    probability: 0.9,
                    ratchet: 1,
                    accent: false,
                    condition: 'always',
                })),
            }));
        }
        case 'idm': {
            const pulses = (gl) => euclidean(Math.min(9, gl), gl);
            const degrees = [0, 3, 5, 2, 6, 1, 4, 0, 5, 2, 7, 3];
            return updateActiveTrack(p, (t) => {
                const e = pulses(t.gateSteps.length);
                return {
                    ...t,
                    pitchSteps: t.pitchSteps.map((s, i) => ({
                        ...s,
                        scaleDegree: pick(degrees, i),
                        octaveOffset: i % 6 === 5 ? 1 : 0,
                        slide: false,
                    })),
                    gateSteps: t.gateSteps.map((g, i) => ({
                        ...g,
                        active: e[i],
                        gate: 0.3,
                        probability: 0.8,
                        ratchet: i % 11 === 10 ? 4 : i % 5 === 4 ? 2 : 1,
                        accent: i % 8 === 0,
                        condition: i % 6 === 5 ? '2:3' : 'always',
                    })),
                };
            });
        }
        case 'chillout': {
            const degrees = [0, 2, 4, 1, 3, 0, 4, 2];
            return updateActiveTrack(p, (t) => ({
                ...t,
                pitchSteps: t.pitchSteps.map((s, i) => ({
                    ...s,
                    scaleDegree: pick(degrees, i),
                    octaveOffset: 0,
                    slide: false,
                })),
                gateSteps: t.gateSteps.map((g, i) => ({
                    ...g,
                    active: i % 2 === 0,
                    gate: 0.7,
                    probability: 0.85,
                    ratchet: 1,
                    accent: false,
                    condition: 'always',
                })),
            }));
        }
    }
}

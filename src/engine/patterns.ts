import type { GateStep, Pattern, PitchStep, StyleName, Track, VoiceKind } from './types';
import { midiToNearestDegree, scaleLength } from './scales';

export type ArpDirection =
  | 'up'
  | 'down'
  | 'random'
  | 'updown'
  | 'pingpong'
  | 'stack'
  | 'sequence';

let _tid = 0;
function newTrackId(): string {
  return `t${++_tid}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makePitchStep(degree = 0): PitchStep {
  return { scaleDegree: degree, octaveOffset: 0, slide: false };
}

export function makeGateStep(active = false): GateStep {
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

type TrackInit = {
  name: string;
  color: string;
  midiChannel: number;
  voice: VoiceKind;
  length?: number;
};

export function makeTrack(opts: TrackInit): Track {
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
    fx: { delay: 0, reverb: 0, saturation: 0 },
  };
}

export function emptyPattern(): Pattern {
  const tracks: Track[] = [
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

export function addTrack(p: Pattern): Pattern {
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

export function removeTrack(p: Pattern, id: string): Pattern {
  if (p.tracks.length <= 1) return p;
  const tracks = p.tracks.filter((t) => t.id !== id);
  const activeTrackId = p.activeTrackId === id ? tracks[0].id : p.activeTrackId;
  return { ...p, tracks, activeTrackId };
}

export function updateTrackById(p: Pattern, id: string, patch: Partial<Track>): Pattern {
  return {
    ...p,
    tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

export function updateActiveTrack(p: Pattern, fn: (t: Track) => Track): Pattern {
  return {
    ...p,
    tracks: p.tracks.map((t) => (t.id === p.activeTrackId ? fn(t) : t)),
  };
}

export function resizeActiveTrack(p: Pattern, pitchLen: number, gateLen: number): Pattern {
  return updateActiveTrack(p, (t) => ({
    ...t,
    pitchSteps: Array.from({ length: pitchLen }, (_, i) => t.pitchSteps[i] ?? makePitchStep(0)),
    gateSteps: Array.from({ length: gateLen }, (_, i) => t.gateSteps[i] ?? makeGateStep(false)),
  }));
}

export function euclidean(pulses: number, steps: number): boolean[] {
  const result: boolean[] = new Array(steps).fill(false);
  if (pulses <= 0 || steps <= 0) return result;
  if (pulses >= steps) return result.fill(true);
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

export function mutateActiveTrack(p: Pattern, amount: number): Pattern {
  const len = scaleLength(p.scale);
  return updateActiveTrack(p, (t) => ({
    ...t,
    pitchSteps: t.pitchSteps.map((s) =>
      Math.random() < amount
        ? {
            ...s,
            scaleDegree: Math.floor(Math.random() * len),
            octaveOffset:
              Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : s.octaveOffset,
          }
        : s,
    ),
    gateSteps: t.gateSteps.map((g) =>
      Math.random() < amount * 0.5 ? { ...g, active: !g.active } : g,
    ),
  }));
}

export function randomizeActivePitch(p: Pattern): Pattern {
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

export function clearActiveGates(p: Pattern): Pattern {
  return updateActiveTrack(p, (t) => ({
    ...t,
    gateSteps: t.gateSteps.map((g) => ({ ...g, active: false })),
  }));
}

export function allActiveGates(p: Pattern): Pattern {
  return updateActiveTrack(p, (t) => ({
    ...t,
    gateSteps: t.gateSteps.map((g) => ({ ...g, active: true })),
  }));
}

export function applyEuclideanToActive(p: Pattern, pulses: number): Pattern {
  return updateActiveTrack(p, (t) => {
    const pulsePattern = euclidean(pulses, t.gateSteps.length);
    return {
      ...t,
      gateSteps: t.gateSteps.map((g, i) => ({ ...g, active: pulsePattern[i] })),
    };
  });
}

export function rotateActiveTrack(p: Pattern, offset: number): Pattern {
  return updateActiveTrack(p, (t) => {
    const rot = <T>(arr: T[]) => {
      if (arr.length === 0) return arr;
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

export function resetRotationActiveTrack(p: Pattern): Pattern {
  return updateActiveTrack(p, (t) => {
    if (t.rotation === 0) return t;
    const back = -t.rotation;
    const rot = <T>(arr: T[]) => {
      if (arr.length === 0) return arr;
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

export function shiftOctaveActiveTrack(p: Pattern, delta: number): Pattern {
  return updateActiveTrack(p, (t) => ({
    ...t,
    octaveShift: Math.max(-4, Math.min(4, t.octaveShift + delta)),
  }));
}

export function resetOctaveActiveTrack(p: Pattern): Pattern {
  return updateActiveTrack(p, (t) => (t.octaveShift === 0 ? t : { ...t, octaveShift: 0 }));
}

/**
 * Slumpar nudge på alla steg i aktivt spår till ett värde i intervallet ±amount.
 * amount = 0.1 ger ±10% av ett 16-delssteg. Påverkar även passiva steg så att
 * humaniseringen följer med när användaren aktiverar stegen senare.
 */
export function humanizeNudgeActive(p: Pattern, amount: number): Pattern {
  const a = Math.max(0, Math.min(0.5, amount));
  if (a === 0) return resetNudgeActive(p);
  return updateActiveTrack(p, (t) => ({
    ...t,
    gateSteps: t.gateSteps.map((g) => ({
      ...g,
      nudge: (Math.random() * 2 - 1) * a,
    })),
  }));
}

export function resetNudgeActive(p: Pattern): Pattern {
  return updateActiveTrack(p, (t) => ({
    ...t,
    gateSteps: t.gateSteps.map((g) => (g.nudge === 0 ? g : { ...g, nudge: 0 })),
  }));
}

function arrangeByDirection<T>(notes: T[], dir: ArpDirection): T[] {
  const n = notes.length;
  if (n === 0) return [];
  if (n === 1) return [notes[0]];
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
      if (n === 2) return notes.slice();
      const middleDown = notes.slice(1, -1).reverse();
      return [...notes, ...middleDown];
    }
    case 'stack':
    case 'sequence':
      return notes.slice();
  }
}

export function applyChordToActive(
  p: Pattern,
  midiNotes: number[],
  direction: ArpDirection,
): Pattern {
  if (midiNotes.length === 0) return p;
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
      gateSteps: t.gateSteps.map((g, i) =>
        i === 0 ? { ...g, active: true } : g,
      ),
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

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

export function applyStyleToActive(p: Pattern, style: StyleName): Pattern {
  switch (style) {
    case 'ambient': {
      const degrees = [0, 2, 4, 3, 0, 1, 4, 2];
      return updateActiveTrack(
        p,
        (t) => ({
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
        }),
      );
    }
    case 'acid': {
      const pulses = (gl: number) => euclidean(Math.min(11, gl), gl);
      const degrees = [0, 0, 3, 0, 5, 0, 2, 0, 4, 0, 3, 5, 0, 2, 0, 6];
      return updateActiveTrack(
        p,
        (t) => {
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
        },
      );
    }
    case 'berlin': {
      const degrees = [0, 4, 2, 5, 0, 4, 2, 7];
      const octaves = [0, 0, 0, 0, 1, 0, 0, -1];
      return updateActiveTrack(
        p,
        (t) => ({
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
        }),
      );
    }
    case 'idm': {
      const pulses = (gl: number) => euclidean(Math.min(9, gl), gl);
      const degrees = [0, 3, 5, 2, 6, 1, 4, 0, 5, 2, 7, 3];
      return updateActiveTrack(
        p,
        (t) => {
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
        },
      );
    }
    case 'chillout': {
      const degrees = [0, 2, 4, 1, 3, 0, 4, 2];
      return updateActiveTrack(
        p,
        (t) => ({
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
        }),
      );
    }
    case 'synthwave': {
      // Klassisk Nightcall/Kavinsky-estetik: drömsk moll-arp där varannan ton
      // studsar upp en oktav. Grundton → kvint → grundton (oktav upp) →
      // kvint (oktav upp) → ters → kvint → ters (oktav upp) → kvint (oktav upp).
      // Alla gates aktiva = driving 1/16-puls. Accent på slag 1/5/9/13 ger
      // "pulserar i fyra fjärdedelar"-känslan. Inga slides, inga ratchets —
      // det ska låta som en sen nattlig motorväg, inte en techno-klubb.
      const degrees = [0, 4, 0, 4, 2, 4, 2, 4, 5, 4, 5, 4, 2, 4, 2, 4];
      const octaves = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
      return updateActiveTrack(
        p,
        (t) => ({
          ...t,
          pitchSteps: t.pitchSteps.map((s, i) => ({
            ...s,
            scaleDegree: pick(degrees, i),
            octaveOffset: pick(octaves, i),
            slide: false,
            extraNotes: [],
          })),
          gateSteps: t.gateSteps.map((g, i) => ({
            ...g,
            active: true,
            gate: 0.55,
            probability: 0.98,
            ratchet: 1,
            accent: i % 4 === 0,
            condition: 'always',
            velocity: i % 4 === 0 ? 0.9 : 0.72,
            nudge: 0,
          })),
        }),
      );
    }
    case 'outrun': {
      // Outrun = episk, driving 16-dels arp i harmonisk moll. Klättrar upp i
      // trean (i-iii-v-vii) och faller tillbaka i slutet av takten. Oktav-hopp
      // på starten av andra halvan (step 9) = lyft. Slide på sista 16-delen
      // i varje 4-steg-grupp = karakteristisk glide-attack. Ratchet på step 15
      // ger dubbel-puff precis innan loop-start — det där "FM-84"-rytmattacket.
      // Tempo (118 BPM typiskt) sätts via randomize-profilen; själva spåret
      // här är samma oavsett BPM.
      const degrees = [0, 2, 4, 6, 4, 2, 0, 2, 4, 6, 4, 2, 0, 2, 4, 4];
      const octaves = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0];
      return updateActiveTrack(
        p,
        (t) => ({
          ...t,
          pitchSteps: t.pitchSteps.map((s, i) => ({
            ...s,
            scaleDegree: pick(degrees, i),
            octaveOffset: pick(octaves, i),
            // Glide på var 4:e 16-del (step 4, 8, 12, 16) för attack-charm
            slide: i % 4 === 3,
            extraNotes: [],
          })),
          gateSteps: t.gateSteps.map((g, i) => ({
            ...g,
            active: true,
            gate: 0.4,
            probability: 1,
            // Dubbelträff på näst sista stepet → driver loopen framåt
            ratchet: i === 14 ? 2 : 1,
            accent: i % 4 === 0,
            condition: 'always',
            velocity: i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.78 : 0.65,
            nudge: 0,
          })),
        }),
      );
    }
  }
}

/* ---------- Slumpa helt nytt pattern utifrån stil ---------- */

type StyleProfile = {
  scale: import('./types').ScaleName;
  tempo: [number, number];
  swing: [number, number];
  /** Sannolikhet att ett gate blir aktivt per spår-typ. */
  density: { bass: number; lead: number; hats: number; pad: number };
  slidesEvery: number;
  ratchetBias: number;
  accentEvery: number;
  octaveJumpChance: number;
};

const STYLE_PROFILES: Record<StyleName, StyleProfile> = {
  ambient: {
    scale: 'pentatonicMinor',
    tempo: [72, 88],
    swing: [0, 0.1],
    density: { bass: 0.22, lead: 0.18, hats: 0.12, pad: 0.28 },
    slidesEvery: 0,
    ratchetBias: 0,
    accentEvery: 0,
    octaveJumpChance: 0.08,
  },
  acid: {
    scale: 'phrygian',
    tempo: [124, 132],
    swing: [0, 0.12],
    density: { bass: 0.7, lead: 0.55, hats: 0.75, pad: 0.25 },
    slidesEvery: 3,
    ratchetBias: 0.18,
    accentEvery: 4,
    octaveJumpChance: 0.15,
  },
  berlin: {
    scale: 'minor',
    tempo: [112, 122],
    swing: [0, 0.08],
    density: { bass: 0.85, lead: 0.45, hats: 0.7, pad: 0.3 },
    slidesEvery: 0,
    ratchetBias: 0.05,
    accentEvery: 4,
    octaveJumpChance: 0.18,
  },
  idm: {
    scale: 'dorian',
    tempo: [136, 148],
    swing: [0.08, 0.22],
    density: { bass: 0.45, lead: 0.38, hats: 0.65, pad: 0.25 },
    slidesEvery: 0,
    ratchetBias: 0.28,
    accentEvery: 7,
    octaveJumpChance: 0.22,
  },
  chillout: {
    scale: 'pentatonicMajor',
    tempo: [88, 102],
    swing: [0.1, 0.28],
    density: { bass: 0.5, lead: 0.35, hats: 0.5, pad: 0.28 },
    slidesEvery: 0,
    ratchetBias: 0.04,
    accentEvery: 4,
    octaveJumpChance: 0.1,
  },
  synthwave: {
    // "Nightcall"-dröm: moll, mjukt tempo runt 95, driving men inte agressiv.
    // Bas tät (pulserar konstant) men leads/pads glesare — det ger luft för
    // arp:et att andas. Oktav-hopp ofta (det är GREJEN i synthwave).
    // Inga slides (arp är staccato-attack, inte glidande).
    scale: 'minor',
    tempo: [90, 102],
    swing: [0, 0.08],
    density: { bass: 0.9, lead: 0.45, hats: 0.55, pad: 0.35 },
    slidesEvery: 0,
    ratchetBias: 0,
    accentEvery: 4,
    octaveJumpChance: 0.35,
  },
  outrun: {
    // Carpenter Brut / FM-84 / Power Glove: snabbare, dramatisk harmonisk
    // moll (ledton ger den där action-filmkänslan), tätt allt, slides på
    // arp:et för glide-attack, ratchets ibland för fill-drive. Accent på
    // var 4:e för "4/4 på steroider".
    scale: 'harmonicMinor',
    tempo: [112, 126],
    swing: [0, 0.05],
    density: { bass: 0.95, lead: 0.7, hats: 0.82, pad: 0.45 },
    slidesEvery: 4,
    ratchetBias: 0.1,
    accentEvery: 4,
    octaveJumpChance: 0.25,
  },
};

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function densityFor(voice: VoiceKind, profile: StyleProfile): number {
  switch (voice) {
    case 'bass':
      return profile.density.bass;
    case 'lead':
    case 'saw':
      return profile.density.lead;
    case 'hats':
      return profile.density.hats;
    case 'pad':
      return profile.density.pad;
  }
}

function randomizeTrackForStyle(t: Track, profile: StyleProfile, scaleLen: number): Track {
  const dens = densityFor(t.voice, profile);
  const isDrum = t.voice === 'hats';
  const isBass = t.voice === 'bass';

  // Ton-pool: bas gillar grundton/5:a, lead/pad gillar fler steg
  const tonePool = isBass
    ? [0, 0, 0, 2, 4, 4, 6, 0]
    : [0, 2, 3, 4, 5, 6, 0, 4, 2];

  const pitchSteps: PitchStep[] = t.pitchSteps.map((_, i) => {
    const deg = isDrum
      ? 0
      : tonePool[Math.floor(Math.random() * tonePool.length)] % scaleLen;
    const octJump = Math.random() < profile.octaveJumpChance;
    return {
      scaleDegree: deg,
      octaveOffset: octJump ? (Math.random() < 0.5 ? -1 : 1) : 0,
      slide:
        profile.slidesEvery > 0 && i % profile.slidesEvery === profile.slidesEvery - 1,
    };
  });

  const gateSteps: GateStep[] = t.gateSteps.map((_, i) => {
    const isHit = Math.random() < dens;
    const ratchet =
      Math.random() < profile.ratchetBias && isHit
        ? 1 + Math.floor(Math.random() * 3) + 1 // 2..4
        : 1;
    const accent = profile.accentEvery > 0 && i % profile.accentEvery === 0;
    return {
      active: isHit,
      gate: isBass ? 0.45 : 0.6,
      probability: 0.85 + Math.random() * 0.15,
      ratchet,
      accent,
      condition: 'always',
      filterLock: null,
      velocity: accent ? 0.95 : 0.75 + Math.random() * 0.15,
      nudge: 0,
    };
  });

  return {
    ...t,
    pitchSteps,
    gateSteps,
    rotation: 0,
  };
}

/**
 * Helt nytt pattern utifrån genre — skriver över ALLA spår, tempo, skala
 * och swing. Till skillnad från `applyStyleToActive` som bara rör aktivt spår.
 * Resultatet blir ett kul startfrö; användaren kan sen finputsa vidare.
 */
export function randomizePatternByStyle(p: Pattern, style: StyleName): Pattern {
  const profile = STYLE_PROFILES[style];
  const scale = profile.scale;
  const scaleLen = scaleLength(scale);
  const tempo = Math.round(randRange(profile.tempo[0], profile.tempo[1]));
  const swing = Math.round(randRange(profile.swing[0], profile.swing[1]) * 100) / 100;
  const tracks = p.tracks.map((t) => randomizeTrackForStyle(t, profile, scaleLen));
  return {
    ...p,
    scale,
    tempo,
    swing,
    tracks,
  };
}

/* ---------- Copy / paste för pitch- eller gate-raden ---------- */

export type StepRowKind = 'pitch' | 'gate';

export type StepRowClipboard =
  | { kind: 'pitch'; steps: PitchStep[] }
  | { kind: 'gate'; steps: GateStep[] };

export function copyActiveRow(p: Pattern, kind: StepRowKind): StepRowClipboard | null {
  const t = p.tracks.find((tt) => tt.id === p.activeTrackId);
  if (!t) return null;
  if (kind === 'pitch') {
    return { kind: 'pitch', steps: t.pitchSteps.map((s) => ({ ...s })) };
  }
  return { kind: 'gate', steps: t.gateSteps.map((s) => ({ ...s })) };
}

export function pasteRowToActive(p: Pattern, clip: StepRowClipboard): Pattern {
  return updateActiveTrack(p, (t) => {
    if (clip.kind === 'pitch') {
      const src = clip.steps;
      if (src.length === 0) return t;
      return {
        ...t,
        pitchSteps: t.pitchSteps.map((_, i) => ({ ...src[i % src.length] })),
      };
    }
    const src = clip.steps;
    if (src.length === 0) return t;
    return {
      ...t,
      gateSteps: t.gateSteps.map((_, i) => ({ ...src[i % src.length] })),
    };
  });
}

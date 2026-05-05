import { Midi } from '@tonejs/midi';
import type { GateStep, Pattern, PitchStep, ScaleName, Track } from './types';
import { midiToNearestDegree } from './scales';

export type ImportedNote = {
  timeSec: number;
  midi: number;
  durationSec: number;
  velocity: number;
};

export type ImportedTrack = {
  index: number;
  name: string;
  channel: number;
  noteCount: number;
  notes: ImportedNote[];
  durationSec: number;
};

export type ImportedFile = {
  name: string;
  bpm: number;
  durationSec: number;
  tracks: ImportedTrack[];
};

export async function parseMidiFile(file: File): Promise<ImportedFile> {
  const buf = await file.arrayBuffer();
  const midi = new Midi(buf);
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const tracks: ImportedTrack[] = midi.tracks
    .map((t, i) => ({
      index: i,
      name: t.name || `Spår ${i + 1}`,
      channel: t.channel,
      noteCount: t.notes.length,
      durationSec: t.duration,
      notes: t.notes.map((n) => ({
        timeSec: n.time,
        midi: n.midi,
        durationSec: n.duration,
        velocity: n.velocity,
      })),
    }))
    .filter((t) => t.noteCount > 0);
  return {
    name: file.name,
    bpm,
    durationSec: midi.duration,
    tracks,
  };
}

export type QuantResolution = '16n' | '8n' | '4n';

const STEPS_PER_QUARTER: Record<QuantResolution, number> = {
  '4n': 1,
  '8n': 2,
  '16n': 4,
};

export function importTrackToActive(
  p: Pattern,
  imported: ImportedTrack,
  sourceBpm: number,
  quant: QuantResolution,
  maxSteps = 64,
): Pattern {
  const stepsPerBeat = STEPS_PER_QUARTER[quant];
  const secPerBeat = 60 / sourceBpm;
  const secPerStep = secPerBeat / stepsPerBeat;
  const totalSteps = Math.max(
    1,
    Math.min(maxSteps, Math.ceil(imported.durationSec / secPerStep)),
  );

  const stepBuckets: ImportedNote[][] = Array.from({ length: totalSteps }, () => []);
  for (const n of imported.notes) {
    const idx = Math.min(totalSteps - 1, Math.round(n.timeSec / secPerStep));
    stepBuckets[idx].push(n);
  }

  const pitchSteps: PitchStep[] = [];
  const gateSteps: GateStep[] = [];
  for (let i = 0; i < totalSteps; i++) {
    const bucket = stepBuckets[i];
    if (bucket.length === 0) {
      pitchSteps.push({ scaleDegree: 0, octaveOffset: 0, slide: false });
      gateSteps.push({
        active: false,
        gate: 0.5,
        probability: 1,
        ratchet: 1,
        accent: false,
        condition: 'always',
        filterLock: null,
        velocity: 0.8,
        nudge: 0,
      });
      continue;
    }
    const sorted = bucket.slice().sort((a, b) => a.midi - b.midi);
    const primary = sorted[0];
    const extras = sorted.slice(1).map((n) =>
      midiToNearestDegree(n.midi, p.rootNote, p.baseOctave, p.scale),
    );
    const primaryDeg = midiToNearestDegree(primary.midi, p.rootNote, p.baseOctave, p.scale);
    const gateFrac = Math.max(
      0.1,
      Math.min(1, primary.durationSec / secPerStep),
    );
    const accent = primary.velocity > 0.85;
    pitchSteps.push({
      scaleDegree: primaryDeg.scaleDegree,
      octaveOffset: primaryDeg.octaveOffset,
      semitoneOffset:
        primaryDeg.semitoneOffset !== 0 ? primaryDeg.semitoneOffset : undefined,
      slide: false,
      extraNotes: extras.length > 0 ? extras : undefined,
    });
    gateSteps.push({
      active: true,
      gate: gateFrac,
      probability: 1,
      ratchet: 1,
      accent,
      condition: 'always',
      filterLock: null,
      velocity: Math.max(0.2, Math.min(1, primary.velocity)),
      nudge: 0,
    });
  }

  return {
    ...p,
    tracks: p.tracks.map((t) =>
      t.id === p.activeTrackId
        ? ({ ...t, pitchSteps, gateSteps, rotation: 0 } satisfies Track)
        : t,
    ),
  };
}

export function scaleSuggestionFromNotes(
  notes: ImportedNote[],
  root: number,
  baseOctave: number,
  scales: ScaleName[],
): ScaleName {
  let bestScale = scales[0];
  let bestScore = -Infinity;
  for (const s of scales) {
    let score = 0;
    for (const n of notes) {
      const { scaleDegree } = midiToNearestDegree(n.midi, root, baseOctave, s);
      if (scaleDegree >= 0) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestScale = s;
    }
  }
  return bestScale;
}

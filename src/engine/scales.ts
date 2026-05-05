import type { ScaleName } from './types';

export const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonicMinor: [0, 3, 5, 7, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
};

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: 'Dur',
  minor: 'Moll',
  dorian: 'Dorisk',
  phrygian: 'Frygisk',
  lydian: 'Lydisk',
  mixolydian: 'Mixolydisk',
  pentatonicMinor: 'Pentatonisk moll',
  pentatonicMajor: 'Pentatonisk dur',
  harmonicMinor: 'Harmonisk moll',
  blues: 'Blues',
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function scaleLength(scale: ScaleName): number {
  return SCALE_INTERVALS[scale].length;
}

export function degreeToMidi(
  root: number,
  baseOctave: number,
  scale: ScaleName,
  scaleDegree: number,
  octaveOffset: number,
  semitoneOffset = 0,
): number {
  const intervals = SCALE_INTERVALS[scale];
  const len = intervals.length;
  let degree = scaleDegree;
  let octWrap = 0;
  while (degree >= len) {
    degree -= len;
    octWrap += 1;
  }
  while (degree < 0) {
    degree += len;
    octWrap -= 1;
  }
  const interval = intervals[degree];
  return (
    (baseOctave + 1) * 12 +
    root +
    interval +
    (octWrap + octaveOffset) * 12 +
    semitoneOffset
  );
}

export function midiToName(midi: number): string {
  const n = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${n}${oct}`;
}

export function midiToNearestDegree(
  midi: number,
  root: number,
  baseOctave: number,
  scale: ScaleName,
): { scaleDegree: number; octaveOffset: number; semitoneOffset: number } {
  const intervals = SCALE_INTERVALS[scale];
  const rootMidi = (baseOctave + 1) * 12 + root;
  const rel = midi - rootMidi;
  const octaveOffset = Math.floor(rel / 12);
  const within = ((rel % 12) + 12) % 12;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < intervals.length; i++) {
    const d = Math.abs(intervals[i] - within);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  // semitoneOffset = skillnaden mellan inkommande halvton och närmsta skala-ton.
  // Bevarar exakt MIDI-tonen även när skalan inte innehåller den.
  const semitoneOffset = within - intervals[bestIdx];
  return { scaleDegree: bestIdx, octaveOffset, semitoneOffset };
}

/**
 * Parsar ett tonnamn ("C3", "F#4", "Bb2", "C", "1", "5") till en pitch-spec
 * (scaleDegree + octaveOffset + semitoneOffset). Returnerar null vid ogiltig
 * inmatning. Tonart/skala/oktav används för att placera resultatet i samma
 * kontext som de befintliga stegen.
 *
 * - Bara siffra "1".."N" (där N = scaleLength): direkt scaleDegree, oktav 0
 * - Tonnamn med oktav ("C3"): exakt MIDI → midiToNearestDegree
 * - Tonnamn utan oktav ("C"): tolkas i samma oktav som baseOctave + degreeOctave
 *   så användaren kan skriva "C" och få ung. samma rad som steget hade
 */
export function parseNoteInput(
  input: string,
  root: number,
  baseOctave: number,
  scale: ScaleName,
  contextOctave = 0,
): { scaleDegree: number; octaveOffset: number; semitoneOffset: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Ren siffra → scale degree (1..N i UI:t = 0..N-1 internt)
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    const len = SCALE_INTERVALS[scale].length;
    if (n < 1 || n > len) return null;
    return { scaleDegree: n - 1, octaveOffset: 0, semitoneOffset: 0 };
  }

  // Tonnamn: [A-G][#bs♯♭]?[oktav]?
  const m = trimmed.match(/^([A-Ga-g])([#bs♯♭]?)(-?\d+)?$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const accidental = m[2];
  const octStr = m[3];

  const letterToPc: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let pc = letterToPc[letter];
  if (accidental === '#' || accidental === 's' || accidental === '♯') pc += 1;
  else if (accidental === 'b' || accidental === '♭') pc -= 1;
  pc = ((pc % 12) + 12) % 12;

  // Om oktav anges: bygg MIDI direkt och hitta närmsta skalsteg + offset.
  // Annars: placera i en oktav nära contextOctave (samma "rad" som steget hade)
  // så drag/edit på ett step inte plötsligt hoppar fyra oktaver.
  let midi: number;
  if (octStr !== undefined) {
    const oct = parseInt(octStr, 10);
    midi = (oct + 1) * 12 + pc;
  } else {
    // baseOctave är t.ex. 3 → MIDI 60 är C4. Vi siktar på samma oktavband
    // som steget redan har: baseOctave + contextOctave.
    const targetOct = baseOctave + contextOctave;
    midi = (targetOct + 1) * 12 + pc;
  }

  return midiToNearestDegree(midi, root, baseOctave, scale);
}

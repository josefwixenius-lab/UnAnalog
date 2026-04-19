export const SCALE_INTERVALS = {
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
export const SCALE_LABELS = {
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
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function scaleLength(scale) {
    return SCALE_INTERVALS[scale].length;
}
export function degreeToMidi(root, baseOctave, scale, scaleDegree, octaveOffset) {
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
    return (baseOctave + 1) * 12 + root + interval + (octWrap + octaveOffset) * 12;
}
export function midiToName(midi) {
    const n = NOTE_NAMES[((midi % 12) + 12) % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${n}${oct}`;
}
export function midiToNearestDegree(midi, root, baseOctave, scale) {
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
    return { scaleDegree: bestIdx, octaveOffset };
}

import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { degreeToMidi, midiToName, scaleLength } from '../engine/scales';
export function PitchTrack({ pattern, track, currentStep, onChangeTrack }) {
    const len = scaleLength(pattern.scale);
    const updateStep = (i, patch) => {
        onChangeTrack((t) => {
            const next = t.pitchSteps.slice();
            next[i] = { ...next[i], ...patch };
            return { ...t, pitchSteps: next };
        });
    };
    const addExtraNote = (i) => {
        onChangeTrack((t) => {
            const next = t.pitchSteps.slice();
            const cur = next[i];
            const extras = cur.extraNotes ?? [];
            const lastDeg = extras.length > 0 ? extras[extras.length - 1].scaleDegree : cur.scaleDegree;
            const lastOct = extras.length > 0 ? extras[extras.length - 1].octaveOffset : cur.octaveOffset;
            let nextDeg = lastDeg + 2;
            let nextOct = lastOct;
            if (nextDeg >= len) {
                nextDeg = nextDeg - len;
                nextOct = Math.min(2, nextOct + 1);
            }
            next[i] = { ...cur, extraNotes: [...extras, { scaleDegree: nextDeg, octaveOffset: nextOct }] };
            return { ...t, pitchSteps: next };
        });
    };
    const updateExtraNote = (i, noteIdx, patch) => {
        onChangeTrack((t) => {
            const next = t.pitchSteps.slice();
            const cur = next[i];
            const extras = (cur.extraNotes ?? []).slice();
            extras[noteIdx] = { ...extras[noteIdx], ...patch };
            next[i] = { ...cur, extraNotes: extras };
            return { ...t, pitchSteps: next };
        });
    };
    const removeExtraNote = (i, noteIdx) => {
        onChangeTrack((t) => {
            const next = t.pitchSteps.slice();
            const cur = next[i];
            const extras = (cur.extraNotes ?? []).filter((_, k) => k !== noteIdx);
            next[i] = { ...cur, extraNotes: extras.length > 0 ? extras : undefined };
            return { ...t, pitchSteps: next };
        });
    };
    return (_jsxs("div", { className: "track track--pitch", children: [_jsxs("div", { className: "track__header", children: [_jsxs("h2", { style: { color: track.color }, children: ["Pitch \u00B7 ", track.name] }), _jsxs("span", { className: "muted", children: [track.pitchSteps.length, " steg"] })] }), _jsx("div", { className: "steps", children: track.pitchSteps.map((s, i) => {
                    const midi = degreeToMidi(pattern.rootNote, pattern.baseOctave + track.octaveShift, pattern.scale, s.scaleDegree, s.octaveOffset);
                    const playing = i === currentStep;
                    const extras = s.extraNotes ?? [];
                    const isDrum = track.voice === 'hats';
                    return (_jsxs("div", { className: `step step--pitch ${playing ? 'is-playing' : ''} ${extras.length > 0 ? 'has-chord' : ''}`, children: [_jsx("div", { className: "step__noteName", children: midiToName(midi) }), _jsx("select", { className: "step__degree", value: s.scaleDegree, onChange: (e) => updateStep(i, { scaleDegree: Number(e.target.value) }), title: "Skalsteg", children: Array.from({ length: len }, (_, d) => (_jsx("option", { value: d, children: d + 1 }, d))) }), _jsxs("div", { className: "step__octave", children: [_jsx("button", { className: "tiny", onClick: () => updateStep(i, { octaveOffset: Math.max(-2, s.octaveOffset - 1) }), title: "Oktav ner", children: "\u2212" }), _jsx("span", { children: s.octaveOffset > 0 ? `+${s.octaveOffset}` : s.octaveOffset }), _jsx("button", { className: "tiny", onClick: () => updateStep(i, { octaveOffset: Math.min(2, s.octaveOffset + 1) }), title: "Oktav upp", children: "+" })] }), _jsxs("label", { className: "step__slide", children: [_jsx("input", { type: "checkbox", checked: s.slide, onChange: (e) => updateStep(i, { slide: e.target.checked }) }), _jsx("span", { children: "glide" })] }), !isDrum && (_jsxs("div", { className: "step__chord", children: [extras.map((n, k) => {
                                        const extraMidi = degreeToMidi(pattern.rootNote, pattern.baseOctave + track.octaveShift, pattern.scale, n.scaleDegree, n.octaveOffset);
                                        return (_jsxs("div", { className: "step__chord-note", title: midiToName(extraMidi), children: [_jsx("select", { value: n.scaleDegree, onChange: (e) => updateExtraNote(i, k, { scaleDegree: Number(e.target.value) }), children: Array.from({ length: len }, (_, d) => (_jsx("option", { value: d, children: d + 1 }, d))) }), _jsx("span", { className: "step__chord-oct", children: n.octaveOffset > 0 ? `+${n.octaveOffset}` : n.octaveOffset }), _jsx("button", { className: "tiny", onClick: () => removeExtraNote(i, k), title: "Ta bort ton", children: "\u00D7" })] }, k));
                                    }), _jsx("button", { className: "tiny step__chord-add", onClick: () => addExtraNote(i), title: "Stapla ton (l\u00E4gger tersen/kvinten ovanp\u00E5)", disabled: extras.length >= 5, children: "+ ton" })] }))] }, i));
                }) })] }));
}

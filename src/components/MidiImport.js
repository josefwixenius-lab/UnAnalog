import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { parseMidiFile, } from '../engine/midiImport';
const QUANTS = [
    { id: '16n', label: '1/16', hint: 'finast — fångar alla detaljer' },
    { id: '8n', label: '1/8', hint: 'medium — bra för melodier' },
    { id: '4n', label: '1/4', hint: 'grov — bara huvudslag' },
];
export function MidiImport({ activeTrackName, onImport }) {
    const [parsed, setParsed] = useState(null);
    const [selected, setSelected] = useState(null);
    const [quant, setQuant] = useState('16n');
    const [error, setError] = useState(null);
    const fileRef = useRef(null);
    const onFile = async (file) => {
        setError(null);
        try {
            const f = await parseMidiFile(file);
            if (f.tracks.length === 0) {
                setError('Ingen not-data i filen.');
                setParsed(null);
                return;
            }
            setParsed(f);
            setSelected(f.tracks[0].index);
        }
        catch (e) {
            setError('Kunde inte läsa filen – är det en MIDI-fil?');
            setParsed(null);
        }
    };
    const applyImport = () => {
        if (!parsed || selected == null)
            return;
        const trk = parsed.tracks.find((t) => t.index === selected);
        if (!trk)
            return;
        onImport(parsed, trk, quant);
    };
    const reset = () => {
        setParsed(null);
        setSelected(null);
        setError(null);
        if (fileRef.current)
            fileRef.current.value = '';
    };
    return (_jsxs("div", { className: "midi-import group--tools", children: [_jsxs("span", { className: "group__label", children: ["MIDI-filimport \u2192 ", activeTrackName] }), !parsed && (_jsxs("div", { className: "field-row", children: [_jsxs("label", { className: "btn", children: ["\uD83D\uDCC2 V\u00E4lj .mid / .midi", _jsx("input", { ref: fileRef, type: "file", accept: ".mid,.midi,audio/midi", style: { display: 'none' }, onChange: (e) => {
                                    const f = e.target.files?.[0];
                                    if (f)
                                        void onFile(f);
                                } })] }), error && _jsx("span", { className: "hint hint--warn", children: error }), _jsx("span", { className: "hint", children: "Filen kvantiseras till steg, toner snappas till valda skalan, samtidiga toner staplas." })] })), parsed && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field-row", children: [_jsxs("span", { className: "hint", children: [_jsx("strong", { children: parsed.name }), " \u00B7 ", parsed.bpm.toFixed(0), " BPM \u00B7", ' ', parsed.durationSec.toFixed(1), " s \u00B7 ", parsed.tracks.length, " sp\u00E5r"] }), _jsx("button", { className: "chip", onClick: reset, children: "\u27F2 Byt fil" })] }), _jsxs("div", { className: "field-row", children: [_jsx("span", { className: "group__label", children: "Sp\u00E5r i filen" }), _jsx("div", { className: "midi-import__tracks", children: parsed.tracks.map((t) => (_jsxs("button", { className: `chip ${selected === t.index ? 'is-on' : ''}`, onClick: () => setSelected(t.index), title: `Kanal ${t.channel + 1} · ${t.noteCount} noter · ${t.durationSec.toFixed(1)} s`, children: [t.name, " \u00B7 ", t.noteCount, "n"] }, t.index))) })] }), _jsxs("div", { className: "field-row", children: [_jsx("span", { className: "group__label", children: "Kvantisering" }), QUANTS.map((q) => (_jsx("button", { className: `chip ${quant === q.id ? 'is-on' : ''}`, onClick: () => setQuant(q.id), title: q.hint, children: q.label }, q.id))), _jsxs("button", { className: "btn btn--primary", onClick: applyImport, disabled: selected == null, children: ["\u21E3 Importera till ", activeTrackName] })] }), _jsx("div", { className: "field-row", children: _jsx("span", { className: "hint", children: "Tips: importen skriver \u00F6ver b\u00E5de pitch- och gate-sp\u00E5ret p\u00E5 aktivt sp\u00E5r. BPM och skala r\u00F6rs inte." }) })] }))] }));
}

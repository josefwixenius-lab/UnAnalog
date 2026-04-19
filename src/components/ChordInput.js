import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureChord, captureSequence, getMidiInputs } from '../engine/midi';
import { midiToName } from '../engine/scales';
const DIRECTIONS = [
    { id: 'up', label: '↑ Upp', hint: 'lägsta → högsta' },
    { id: 'down', label: '↓ Ner', hint: 'högsta → lägsta' },
    { id: 'random', label: '? Slump', hint: 'slumpad ordning' },
    { id: 'updown', label: '↕ Fram & tillbaka', hint: 'upp och ner, ändtoner upprepas' },
    { id: 'pingpong', label: '⇄ Ping-pong', hint: 'upp och ner, ändtoner repeteras inte' },
    { id: 'stack', label: '▦ Stapla', hint: 'alla toner samtidigt på ett enda steg' },
];
export function ChordInput({ activeTrackName, onChord }) {
    const [inputs, setInputs] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [direction, setDirection] = useState('up');
    const [armed, setArmed] = useState(false);
    const [held, setHeld] = useState([]);
    const [lastChord, setLastChord] = useState([]);
    const handleRef = useRef(null);
    const directionRef = useRef(direction);
    // Sekvensinspelning (ton-för-ton)
    const [seqArmed, setSeqArmed] = useState(false);
    const [seqNotes, setSeqNotes] = useState([]);
    const seqHandleRef = useRef(null);
    useEffect(() => {
        directionRef.current = direction;
    }, [direction]);
    useEffect(() => {
        getMidiInputs()
            .then((ins) => {
            setInputs(ins);
            if (ins.length > 0)
                setSelectedIds(new Set([ins[0].id]));
        })
            .catch(() => setInputs([]));
    }, []);
    const stopListening = useCallback(() => {
        handleRef.current?.stop();
        handleRef.current = null;
        setArmed(false);
        setHeld([]);
    }, []);
    const startListening = useCallback(() => {
        // Stäng sekvens-lyssning först så vi inte fångar note-on två gånger
        seqHandleRef.current?.cancel();
        seqHandleRef.current = null;
        setSeqArmed(false);
        setSeqNotes([]);
        const ports = inputs.filter((i) => selectedIds.has(i.id)).map((i) => i.port);
        if (ports.length === 0) {
            alert('Ingen MIDI-ingång vald. Anslut ett keyboard och försök igen.');
            return;
        }
        const h = captureChord(ports, {
            onNoteOn: (midi) => setHeld((prev) => (prev.includes(midi) ? prev : [...prev, midi])),
            onNoteOff: (midi) => setHeld((prev) => prev.filter((m) => m !== midi)),
            onComplete: (midis) => {
                setLastChord(midis);
                onChord(midis, directionRef.current);
                stopListening();
            },
        });
        handleRef.current = h;
        setArmed(true);
        setHeld([]);
    }, [inputs, selectedIds, onChord, stopListening]);
    useEffect(() => () => handleRef.current?.stop(), []);
    useEffect(() => () => seqHandleRef.current?.cancel(), []);
    const startSequence = useCallback(() => {
        // Stäng ev. ackord-lyssning först för att undvika att note-on tas två gånger
        handleRef.current?.stop();
        handleRef.current = null;
        setArmed(false);
        setHeld([]);
        const ports = inputs.filter((i) => selectedIds.has(i.id)).map((i) => i.port);
        if (ports.length === 0) {
            alert('Ingen MIDI-ingång vald. Anslut ett keyboard och försök igen.');
            return;
        }
        setSeqNotes([]);
        const h = captureSequence(ports, {
            onNote: (_midi, all) => setSeqNotes(all),
            onUndo: (all) => setSeqNotes(all),
            onFinish: (all) => {
                if (all.length > 0) {
                    setLastChord(all);
                    onChord(all, 'sequence');
                }
                setSeqArmed(false);
                setSeqNotes([]);
                seqHandleRef.current = null;
            },
        });
        seqHandleRef.current = h;
        setSeqArmed(true);
    }, [inputs, selectedIds, onChord]);
    const finishSequence = useCallback(() => {
        seqHandleRef.current?.finish();
    }, []);
    const cancelSequence = useCallback(() => {
        seqHandleRef.current?.cancel();
        seqHandleRef.current = null;
        setSeqArmed(false);
        setSeqNotes([]);
    }, []);
    const undoLastNote = useCallback(() => {
        seqHandleRef.current?.undo();
    }, []);
    const toggleInput = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    const noMidi = inputs.length === 0;
    return (_jsxs("div", { className: "chord group--tools", children: [_jsxs("span", { className: "group__label", children: ["Ackord-input \u2192 ", activeTrackName] }), _jsx("div", { className: "field-row", children: _jsx("div", { className: "chord__dir", children: DIRECTIONS.map((d) => (_jsx("button", { className: `chip chord__dir-btn ${direction === d.id ? 'is-on' : ''}`, onClick: () => setDirection(d.id), title: d.hint, children: d.label }, d.id))) }) }), _jsxs("div", { className: "field-row", children: [noMidi ? (_jsx("span", { className: "hint", children: "Ingen MIDI-ing\u00E5ng hittades. Anslut ett keyboard och ladda om sidan." })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "group__label", children: "MIDI in" }), _jsx("div", { className: "chord__inputs", children: inputs.map((i) => (_jsxs("label", { className: "field field--toggle", children: [_jsx("input", { type: "checkbox", checked: selectedIds.has(i.id), onChange: () => toggleInput(i.id) }), _jsx("span", { children: i.name })] }, i.id))) })] })), _jsx("button", { className: `btn ${armed ? 'is-on' : ''}`, disabled: noMidi || selectedIds.size === 0 || seqArmed, onClick: armed ? stopListening : startListening, title: "H\u00E5ll ett ackord \u2013 sl\u00E4pp alla toner f\u00F6r att skicka", children: armed ? '◼ Avbryt' : '◉ Spela ackord' }), _jsx("button", { className: `btn ${seqArmed ? 'is-on' : ''}`, disabled: noMidi || selectedIds.size === 0 || armed, onClick: seqArmed ? cancelSequence : startSequence, title: "Spela ton f\u00F6r ton i valfri ordning. Paus mellan toner \u00E4r OK.", children: seqArmed ? '◼ Avbryt' : '🎹 Spela in toner' })] }), armed && (_jsx("div", { className: "field-row", children: _jsx("span", { className: "hint", children: held.length === 0
                        ? 'Väntar — spela ett ackord…'
                        : `Håller: ${held.map(midiToName).join(' · ')}  (släpp för att omvandla)` }) })), seqArmed && (_jsxs("div", { className: "field-row chord__seq", children: [_jsx("span", { className: "hint", children: seqNotes.length === 0
                            ? 'Spela in en ton i taget — ordningen bevaras.'
                            : `Inspelat (${seqNotes.length}): ${seqNotes.map(midiToName).join(' → ')}` }), _jsx("button", { className: "chip", onClick: undoLastNote, disabled: seqNotes.length === 0, title: "Ta bort senast inspelade ton", children: "\u21BA \u00C5ngra ton" }), _jsx("button", { className: "btn btn--primary", onClick: finishSequence, disabled: seqNotes.length === 0, title: "Skicka sekvensen till aktiva sp\u00E5ret", children: "\u2713 Klart" })] })), !armed && !seqArmed && lastChord.length > 0 && (_jsx("div", { className: "field-row", children: _jsxs("span", { className: "hint", children: ["Senast: ", lastChord.map(midiToName).join(' · '), " \u2192 ", lastChord.length, " toner \u2192", ' ', stepsForDirection(lastChord.length, direction), " steg"] }) }))] }));
}
function stepsForDirection(n, dir) {
    if (n <= 1)
        return Math.max(1, n);
    switch (dir) {
        case 'up':
        case 'down':
        case 'random':
        case 'sequence':
            return n;
        case 'updown':
            return n * 2;
        case 'pingpong':
            return Math.max(2, 2 * n - 2);
        case 'stack':
            return 1;
    }
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sequencer } from './engine/sequencer';
import { addTrack, allActiveGates, applyChordToActive, applyEuclideanToActive, applyStyleToActive, clearActiveGates, humanizeNudgeActive, mutateActiveTrack, randomizeActivePitch, removeTrack, resetNudgeActive, resetOctaveActiveTrack, resetRotationActiveTrack, resizeActiveTrack, rotateActiveTrack, shiftOctaveActiveTrack, updateActiveTrack, updateTrackById, } from './engine/patterns';
import { getMidiInputs, getMidiOutputs, listenMidiClock, panicMidi, sendMidiClockPulse, sendMidiNote, sendMidiStart, sendMidiStop, } from './engine/midi';
import * as Tone from 'tone';
import { clearSlot, downloadBankFile, emptyBank, getActivePattern, importBankJson, loadBank, saveBank, setActivePattern, setActiveSlot, } from './engine/bank';
import { Transport } from './components/Transport';
import { KeyScale } from './components/KeyScale';
import { PitchTrack } from './components/PitchTrack';
import { GateTrack } from './components/GateTrack';
import { Tools } from './components/Tools';
import { MidiPicker } from './components/MidiPicker';
import { StylePresets } from './components/StylePresets';
import { TrackStrip } from './components/TrackStrip';
import { PatternBank } from './components/PatternBank';
import { SongChain } from './components/SongChain';
import { ChordInput } from './components/ChordInput';
import { MidiImport } from './components/MidiImport';
import { Manual } from './components/Manual';
import { importTrackToActive } from './engine/midiImport';
import { APP_META } from './meta';
export default function App() {
    const [bank, setBank] = useState(() => loadBank() ?? emptyBank());
    const [playing, setPlaying] = useState(false);
    const [audible, setAudible] = useState(true);
    const [currentSteps, setCurrentSteps] = useState({});
    const [midiOuts, setMidiOuts] = useState([]);
    const [selectedMidiId, setSelectedMidiId] = useState('');
    const [syncMode, setSyncMode] = useState('nextBar');
    const [queuedSlot, setQueuedSlot] = useState(null);
    const [songIndex, setSongIndex] = useState(0);
    const [clockOutEnabled, setClockOutEnabled] = useState(false);
    const [clockSource, setClockSource] = useState('internal');
    const [midiIns, setMidiIns] = useState([]);
    const [externalBpm, setExternalBpm] = useState(null);
    const [externalListening, setExternalListening] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const pattern = useMemo(() => getActivePattern(bank), [bank]);
    const selectedMidi = useMemo(() => midiOuts.find((m) => m.id === selectedMidiId) ?? null, [midiOuts, selectedMidiId]);
    const midiRef = useRef(null);
    useEffect(() => {
        midiRef.current = selectedMidi;
    }, [selectedMidi]);
    const handleNote = useCallback((evt) => {
        const out = midiRef.current;
        if (out) {
            sendMidiNote(out.port, evt.midiChannel, evt.midi, evt.velocity, evt.durationSec, evt.timeSec);
        }
    }, []);
    const handleClock = useCallback((msg, whenAudioSec) => {
        const out = midiRef.current;
        if (!out)
            return;
        switch (msg) {
            case 'clock':
                sendMidiClockPulse(out.port, whenAudioSec);
                break;
            case 'start':
                sendMidiStart(out.port, whenAudioSec);
                break;
            case 'stop':
                sendMidiStop(out.port, whenAudioSec);
                break;
            case 'continue':
                // reserverat — idag skickar vi alltid Start
                break;
        }
    }, []);
    const handleStep = useCallback((trackId, pitchIdx, gateIdx) => {
        setCurrentSteps((prev) => ({ ...prev, [trackId]: { pitch: pitchIdx, gate: gateIdx } }));
    }, []);
    const queuedSlotRef = useRef(null);
    useEffect(() => {
        queuedSlotRef.current = queuedSlot;
    }, [queuedSlot]);
    const bankRef = useRef(bank);
    useEffect(() => {
        bankRef.current = bank;
    }, [bank]);
    const songIndexRef = useRef(0);
    useEffect(() => {
        songIndexRef.current = songIndex;
    }, [songIndex]);
    const barCountRef = useRef(0);
    const handleBar = useCallback(() => {
        const b = bankRef.current;
        const isFirstBar = barCountRef.current === 0;
        barCountRef.current += 1;
        const queued = queuedSlotRef.current;
        if (queued) {
            setBank((cur) => setActiveSlot(cur, queued));
            setQueuedSlot(null);
            return;
        }
        if (b.songMode && b.song.length > 0) {
            const nextIdx = isFirstBar ? 0 : (songIndexRef.current + 1) % b.song.length;
            const nextSlot = b.song[nextIdx];
            songIndexRef.current = nextIdx;
            setSongIndex(nextIdx);
            if (b.slots[nextSlot] && b.activeSlot !== nextSlot) {
                setBank((cur) => setActiveSlot(cur, nextSlot));
            }
        }
    }, []);
    const seqRef = useRef(null);
    if (seqRef.current === null) {
        seqRef.current = new Sequencer(pattern, {
            onNote: handleNote,
            onStep: handleStep,
            onBar: handleBar,
            onClock: handleClock,
        });
    }
    useEffect(() => {
        seqRef.current.setCallbacks({
            onNote: handleNote,
            onStep: handleStep,
            onBar: handleBar,
            onClock: handleClock,
        });
    }, [handleNote, handleStep, handleBar, handleClock]);
    useEffect(() => {
        seqRef.current.setClockEnabled(clockOutEnabled && !!selectedMidi);
    }, [clockOutEnabled, selectedMidi]);
    useEffect(() => {
        seqRef.current.setPattern(pattern);
    }, [pattern]);
    useEffect(() => {
        seqRef.current.setAudible(audible);
    }, [audible]);
    useEffect(() => {
        const id = window.setTimeout(() => saveBank(bank), 500);
        return () => window.clearTimeout(id);
    }, [bank]);
    useEffect(() => {
        getMidiOutputs()
            .then((outs) => setMidiOuts(outs))
            .catch(() => setMidiOuts([]));
        getMidiInputs()
            .then((ins) => setMidiIns(ins))
            .catch(() => setMidiIns([]));
    }, []);
    // När vi byter till extern klocka: stäng av "Clock ut" (feedback-skydd)
    // och nollställ extern BPM-indikator.
    useEffect(() => {
        if (clockSource === 'external') {
            setClockOutEnabled(false);
        }
        else {
            // Tillbaka till intern: släpp extern tempo-override
            seqRef.current.setExternalTempo(null);
            setExternalBpm(null);
            setExternalListening(false);
        }
    }, [clockSource]);
    // Aktiv extern clock-lyssning. Start/Stop från master triggar sekvensen.
    useEffect(() => {
        if (clockSource !== 'external' || !externalListening)
            return;
        if (midiIns.length === 0)
            return;
        const handle = listenMidiClock(midiIns.map((m) => m.port), {
            onTempo: (bpm) => {
                seqRef.current.setExternalTempo(bpm);
                setExternalBpm(bpm);
            },
            onStart: () => {
                barCountRef.current = 0;
                // async start fire-and-forget; Tone.start är redan körd vid arm
                void seqRef.current.start();
                setPlaying(true);
            },
            onContinue: () => {
                void seqRef.current.start();
                setPlaying(true);
            },
            onStop: () => {
                seqRef.current.stop();
                if (midiRef.current) {
                    for (const t of pattern.tracks)
                        panicMidi(midiRef.current.port, t.midiChannel);
                }
                setPlaying(false);
            },
        });
        return () => handle.stop();
    }, [clockSource, externalListening, midiIns, pattern.tracks]);
    const togglePlay = useCallback(async () => {
        if (clockSource === 'external') {
            // Externt läge: play-knappen armar/avarmar lyssning.
            // Själva start/stop triggas av inkommande 0xFA/0xFC.
            if (externalListening) {
                setExternalListening(false);
                seqRef.current.stop();
                if (midiRef.current) {
                    for (const t of pattern.tracks)
                        panicMidi(midiRef.current.port, t.midiChannel);
                }
                setPlaying(false);
            }
            else {
                // Lås upp audio nu (kräver user gesture) så vi kan spela direkt när
                // external Start kommer.
                await Tone.start();
                seqRef.current.setExternalTempo(externalBpm);
                setExternalListening(true);
            }
            return;
        }
        if (playing) {
            seqRef.current.stop();
            if (midiRef.current) {
                for (const t of pattern.tracks)
                    panicMidi(midiRef.current.port, t.midiChannel);
            }
            setPlaying(false);
            setQueuedSlot(null);
        }
        else {
            barCountRef.current = 0;
            if (bankRef.current.songMode) {
                setSongIndex(0);
                songIndexRef.current = 0;
                const first = bankRef.current.song[0];
                if (first && bankRef.current.slots[first] && bankRef.current.activeSlot !== first) {
                    setBank((cur) => setActiveSlot(cur, first));
                }
            }
            await seqRef.current.start();
            setPlaying(true);
        }
    }, [playing, pattern.tracks, clockSource, externalListening, externalBpm]);
    const updatePattern = useCallback((next) => {
        setBank((b) => {
            const cur = getActivePattern(b);
            const nextP = typeof next === 'function' ? next(cur) : next;
            return setActivePattern(b, nextP);
        });
    }, []);
    const onChangeActiveTrack = useCallback((fn) => updatePattern((p) => updateActiveTrack(p, fn)), [updatePattern]);
    const onChangeTrackById = useCallback((id, patch) => updatePattern((p) => updateTrackById(p, id, patch)), [updatePattern]);
    const onSelectTrack = useCallback((id) => updatePattern((p) => ({ ...p, activeTrackId: id })), [updatePattern]);
    const onAddTrack = useCallback(() => updatePattern(addTrack), [updatePattern]);
    const onRemoveTrack = useCallback((id) => updatePattern((p) => removeTrack(p, id)), [updatePattern]);
    const onStyle = useCallback((style) => updatePattern((p) => applyStyleToActive(p, style)), [updatePattern]);
    const onMutate = useCallback(() => updatePattern((p) => mutateActiveTrack(p, 0.25)), [updatePattern]);
    const onRandomizePitch = useCallback(() => updatePattern((p) => randomizeActivePitch(p)), [updatePattern]);
    const onClearGates = useCallback(() => updatePattern(clearActiveGates), [updatePattern]);
    const onAllGates = useCallback(() => updatePattern(allActiveGates), [updatePattern]);
    const onEuclidean = useCallback((pulses) => updatePattern((p) => applyEuclideanToActive(p, pulses)), [updatePattern]);
    const onRotate = useCallback((offset) => updatePattern((p) => rotateActiveTrack(p, offset)), [updatePattern]);
    const onResetRotation = useCallback(() => updatePattern(resetRotationActiveTrack), [updatePattern]);
    const onOctave = useCallback((delta) => updatePattern((p) => shiftOctaveActiveTrack(p, delta)), [updatePattern]);
    const onResetOctave = useCallback(() => updatePattern(resetOctaveActiveTrack), [updatePattern]);
    const onResize = useCallback((pitchLen, gateLen) => updatePattern((p) => resizeActiveTrack(p, pitchLen, gateLen)), [updatePattern]);
    const onChangeLfo = useCallback((patch) => updatePattern((p) => updateActiveTrack(p, (t) => ({ ...t, lfo: { ...t.lfo, ...patch } }))), [updatePattern]);
    const onChangeVelocityJitter = useCallback((v) => updatePattern((p) => updateActiveTrack(p, (t) => ({ ...t, velocityJitter: v }))), [updatePattern]);
    const onHumanizeNudge = useCallback((amount) => updatePattern((p) => humanizeNudgeActive(p, amount)), [updatePattern]);
    const onResetNudge = useCallback(() => updatePattern(resetNudgeActive), [updatePattern]);
    const onChord = useCallback((midis, dir) => updatePattern((p) => applyChordToActive(p, midis, dir)), [updatePattern]);
    const onMidiImport = useCallback((file, track, quant) => updatePattern((p) => importTrackToActive(p, track, file.bpm, quant)), [updatePattern]);
    const onSelectSlot = useCallback((id) => {
        setBank((b) => {
            if (b.activeSlot === id && b.slots[id])
                return b;
            if (playing && syncMode === 'nextBar' && b.slots[id]) {
                setQueuedSlot(id);
                return b;
            }
            return setActiveSlot(b, id);
        });
    }, [playing, syncMode]);
    const onClearSlot = useCallback((id) => {
        setBank((b) => clearSlot(b, id));
        setQueuedSlot((q) => (q === id ? null : q));
    }, []);
    const onExport = useCallback((customName) => downloadBankFile(bank, customName), [bank]);
    const onImportFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            const imported = importBankJson(text);
            if (imported) {
                setBank(imported);
                setQueuedSlot(null);
                setSongIndex(0);
            }
            else {
                alert('Kunde inte läsa JSON-filen – fel format?');
            }
        };
        reader.readAsText(file);
    }, []);
    const onToggleSongMode = useCallback(() => {
        setBank((b) => ({ ...b, songMode: !b.songMode }));
        setSongIndex(0);
    }, []);
    const onSetSongStep = useCallback((index, slot) => {
        setBank((b) => {
            if (!b.slots[slot])
                return b;
            const song = b.song.slice();
            song[index] = slot;
            return { ...b, song };
        });
    }, []);
    const onAddSongStep = useCallback(() => {
        setBank((b) => {
            const last = b.song[b.song.length - 1] ?? b.activeSlot;
            return { ...b, song: [...b.song, last] };
        });
    }, []);
    const onRemoveSongStep = useCallback((index) => {
        setBank((b) => {
            if (b.song.length <= 1)
                return b;
            const song = b.song.filter((_, i) => i !== index);
            return { ...b, song };
        });
        setSongIndex((i) => (i >= index && i > 0 ? i - 1 : i));
    }, []);
    const onJumpSongStep = useCallback((index) => {
        if (!bankRef.current.songMode)
            return;
        const slot = bankRef.current.song[index];
        if (!slot || !bankRef.current.slots[slot])
            return;
        songIndexRef.current = index;
        setSongIndex(index);
        setBank((cur) => setActiveSlot(cur, slot));
    }, []);
    const activeTrack = pattern.tracks.find((t) => t.id === pattern.activeTrackId) ?? pattern.tracks[0];
    const activeSteps = currentSteps[activeTrack.id] ?? { pitch: -1, gate: -1 };
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { className: "app__header", children: [_jsxs("div", { className: "app__title", children: [_jsx("h1", { children: APP_META.name }), _jsx("button", { className: "btn btn--manual", onClick: () => setManualOpen(true), title: "\u00D6ppna manualen (Esc f\u00F6r att st\u00E4nga)", children: "\uD83D\uDCD6 Manual" })] }), _jsx(Transport, { playing: playing, onTogglePlay: togglePlay, tempo: pattern.tempo, onTempoChange: (v) => updatePattern((p) => ({ ...p, tempo: v })), swing: pattern.swing, onSwingChange: (v) => updatePattern((p) => ({ ...p, swing: v })), audible: audible, onAudibleChange: setAudible, fillActive: pattern.fillActive, onFillChange: (v) => updatePattern((p) => ({ ...p, fillActive: v })), clockOut: clockOutEnabled, onClockOutChange: setClockOutEnabled, clockOutAvailable: !!selectedMidi, clockSource: clockSource, onClockSourceChange: setClockSource, externalBpm: externalBpm, externalListening: externalListening, externalInputAvailable: midiIns.length > 0 })] }), _jsx("section", { className: "panel panel--bank", children: _jsx(PatternBank, { bank: bank, queuedSlot: queuedSlot, syncMode: syncMode, onSyncModeChange: setSyncMode, onSelectSlot: onSelectSlot, onClearSlot: onClearSlot, onExport: onExport, onImportFile: onImportFile }) }), _jsx("section", { className: "panel panel--song", children: _jsx(SongChain, { bank: bank, songIndex: songIndex, onToggleMode: onToggleSongMode, onSetStep: onSetSongStep, onAddStep: onAddSongStep, onRemoveStep: onRemoveSongStep, onJumpTo: onJumpSongStep }) }), _jsxs("section", { className: "panel", children: [_jsx(KeyScale, { root: pattern.rootNote, scale: pattern.scale, baseOctave: pattern.baseOctave, onRoot: (v) => updatePattern((p) => ({ ...p, rootNote: v })), onScale: (v) => updatePattern((p) => ({ ...p, scale: v })), onOctave: (v) => updatePattern((p) => ({ ...p, baseOctave: v })) }), _jsx(MidiPicker, { outputs: midiOuts, selectedId: selectedMidiId, onSelect: setSelectedMidiId })] }), _jsx("section", { className: "panel panel--trackstrip", children: _jsx(TrackStrip, { pattern: pattern, onSelect: onSelectTrack, onChangeTrack: onChangeTrackById, onAdd: onAddTrack, onRemove: onRemoveTrack }) }), _jsxs("section", { className: "panel panel--chord", children: [_jsx(ChordInput, { activeTrackName: activeTrack.name, onChord: onChord }), _jsx(MidiImport, { activeTrackName: activeTrack.name, onImport: onMidiImport })] }), _jsxs("section", { className: "panel", children: [_jsx(StylePresets, { onApply: onStyle }), _jsx(Tools, { activeTrackName: activeTrack.name, activeVoice: activeTrack.voice, pitchLength: activeTrack.pitchSteps.length, gateLength: activeTrack.gateSteps.length, rotation: activeTrack.rotation, octaveShift: activeTrack.octaveShift, lfo: activeTrack.lfo, velocityJitter: activeTrack.velocityJitter ?? 0, onResize: onResize, onMutate: onMutate, onRandomizePitch: onRandomizePitch, onClearGates: onClearGates, onAllGates: onAllGates, onEuclidean: onEuclidean, onRotate: onRotate, onResetRotation: onResetRotation, onOctave: onOctave, onResetOctave: onResetOctave, onChangeLfo: onChangeLfo, onChangeVelocityJitter: onChangeVelocityJitter, onHumanizeNudge: onHumanizeNudge, onResetNudge: onResetNudge })] }), _jsxs("section", { className: "panel panel--tracks", children: [_jsx(PitchTrack, { pattern: pattern, track: activeTrack, currentStep: activeSteps.pitch, onChangeTrack: onChangeActiveTrack }), _jsx(GateTrack, { track: activeTrack, currentStep: activeSteps.gate, onChangeTrack: onChangeActiveTrack })] }), _jsxs("footer", { className: "app__footer", children: [_jsx("small", { children: "Tips: skapa en IAC-buss i macOS (Audio MIDI Setup \u2192 IAC Driver) och v\u00E4lj den som MIDI Ut f\u00F6r att styra Logic. Varje sp\u00E5r skickar p\u00E5 sin egen kanal. Banken sparas automatiskt i webbl\u00E4saren." }), _jsxs("small", { className: "app__copyright", children: ["\u00A9 ", APP_META.year, " ", APP_META.owner, " \u00B7 ", APP_META.name, " v", APP_META.version, " \u00B7", ' ', _jsx("button", { className: "link", onClick: () => setManualOpen(true), children: "\u00D6ppna manual" })] })] }), _jsx(Manual, { open: manualOpen, onClose: () => setManualOpen(false) })] }));
}

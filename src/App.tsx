import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sequencer } from './engine/sequencer';
import type { ClockMessage, NoteEvent } from './engine/sequencer';
import {
  addTrack,
  allActiveGates,
  applyChordToActive,
  applyEuclideanToActive,
  applyStyleToActive,
  clearActiveGates,
  copyActiveRow,
  humanizeNudgeActive,
  mutateActiveTrack,
  pasteRowToActive,
  randomizeActivePitch,
  randomizePatternByStyle,
  removeTrack,
  resetNudgeActive,
  resetOctaveActiveTrack,
  resetRotationActiveTrack,
  resizeActiveTrack,
  rotateActiveTrack,
  shiftOctaveActiveTrack,
  updateActiveTrack,
  updateTrackById,
} from './engine/patterns';
import type { ArpDirection, StepRowClipboard } from './engine/patterns';
import {
  getMidiInputs,
  getMidiOutputs,
  listenMidiClock,
  panicMidi,
  sendMidiClockPulse,
  sendMidiNote,
  sendMidiStart,
  sendMidiStop,
  subscribeMidiPorts,
} from './engine/midi';
import type { MidiIn, MidiOut } from './engine/midi';
import * as Tone from 'tone';
import type { Pattern, StyleName, Track, TrackFx, TrackLfo } from './engine/types';
import type { Bank, SlotId } from './engine/bank';
import {
  clearSlot,
  downloadBankFile,
  emptyBank,
  getActivePattern,
  importBankJson,
  loadBank,
  saveBank,
  setActivePattern,
  setActiveSlot,
} from './engine/bank';
import { Transport } from './components/Transport';
import { KeyScale } from './components/KeyScale';
import { StepEditor } from './components/StepEditor';
import { Tools } from './components/Tools';
import { MidiPicker } from './components/MidiPicker';
import { MidiDiagnostics } from './components/MidiDiagnostics';
import { StylePresets } from './components/StylePresets';
import { TrackStrip } from './components/TrackStrip';
import { PatternBank, type SyncMode } from './components/PatternBank';
import { SongChain } from './components/SongChain';
import { ChordInput } from './components/ChordInput';
import { MidiImport } from './components/MidiImport';
import { Manual } from './components/Manual';
import { QuickActions } from './components/QuickActions';
import { importTrackToActive } from './engine/midiImport';
import { downloadPatternAsMidi } from './engine/midiExport';
import type { ImportedFile, ImportedTrack, QuantResolution } from './engine/midiImport';
import { setMasterVolumeDb } from './engine/audioBus';
import { useUndoable } from './engine/useUndo';
import { APP_META } from './meta';

export default function App() {
  // Bank ligger i en undoable-hook: `setBank` loggar i historik (Cmd+Z undo)
  // medan `setBankSilent` används för engine-automation (bar-sync slotbyte,
  // song-mode-växling, import) som inte ska skapa undo-steg.
  const {
    state: bank,
    set: setBank,
    replace: setBankSilent,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoable<Bank>(() => loadBank() ?? emptyBank());
  const [clipboard, setClipboard] = useState<StepRowClipboard | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audible, setAudible] = useState(true);
  const [currentSteps, setCurrentSteps] = useState<Record<string, { pitch: number; gate: number }>>(
    {},
  );
  const [midiOuts, setMidiOuts] = useState<MidiOut[]>([]);
  const [selectedMidiId, setSelectedMidiId] = useState<string>('');
  const [syncMode, setSyncMode] = useState<SyncMode>('nextBar');
  const [queuedSlot, setQueuedSlot] = useState<SlotId | null>(null);
  const [songIndex, setSongIndex] = useState(0);
  const [clockOutEnabled, setClockOutEnabled] = useState(false);
  const [clockSource, setClockSource] = useState<'internal' | 'external'>('internal');
  const [midiIns, setMidiIns] = useState<MidiIn[]>([]);
  const [externalBpm, setExternalBpm] = useState<number | null>(null);
  const [externalListening, setExternalListening] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [stepDetail, setStepDetail] = useState<'compact' | 'detailed'>(() => {
    if (typeof window === 'undefined') return 'compact';
    return (window.localStorage.getItem('unanalog.stepDetail') as 'compact' | 'detailed') || 'compact';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('unanalog.stepDetail', stepDetail);
    } catch {
      // ignorera — fulla localStorage eller privat läge
    }
  }, [stepDetail]);

  const pattern = useMemo(() => getActivePattern(bank), [bank]);

  const selectedMidi = useMemo(
    () => midiOuts.find((m) => m.id === selectedMidiId) ?? null,
    [midiOuts, selectedMidiId],
  );
  const midiRef = useRef<MidiOut | null>(null);
  useEffect(() => {
    midiRef.current = selectedMidi;
  }, [selectedMidi]);

  const handleNote = useCallback((evt: NoteEvent) => {
    const out = midiRef.current;
    if (out) {
      sendMidiNote(out.port, evt.midiChannel, evt.midi, evt.velocity, evt.durationSec, evt.timeSec);
    }
  }, []);

  const handleClock = useCallback((msg: ClockMessage, whenAudioSec: number) => {
    const out = midiRef.current;
    if (!out) return;
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

  const handleStep = useCallback((trackId: string, pitchIdx: number, gateIdx: number) => {
    setCurrentSteps((prev) => ({ ...prev, [trackId]: { pitch: pitchIdx, gate: gateIdx } }));
  }, []);

  const queuedSlotRef = useRef<SlotId | null>(null);
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
      // Engine-automatik — ska INTE vara ett undo-steg
      setBankSilent(setActiveSlot(b, queued));
      setQueuedSlot(null);
      return;
    }

    if (b.songMode && b.song.length > 0) {
      const nextIdx = isFirstBar ? 0 : (songIndexRef.current + 1) % b.song.length;
      const nextSlot = b.song[nextIdx];
      songIndexRef.current = nextIdx;
      setSongIndex(nextIdx);
      if (b.slots[nextSlot] && b.activeSlot !== nextSlot) {
        setBankSilent(setActiveSlot(b, nextSlot));
      }
    }
  }, [setBankSilent]);

  const seqRef = useRef<Sequencer | null>(null);
  if (seqRef.current === null) {
    seqRef.current = new Sequencer(pattern, {
      onNote: handleNote,
      onStep: handleStep,
      onBar: handleBar,
      onClock: handleClock,
    });
  }

  useEffect(() => {
    seqRef.current!.setCallbacks({
      onNote: handleNote,
      onStep: handleStep,
      onBar: handleBar,
      onClock: handleClock,
    });
  }, [handleNote, handleStep, handleBar, handleClock]);

  useEffect(() => {
    seqRef.current!.setClockEnabled(clockOutEnabled && !!selectedMidi);
  }, [clockOutEnabled, selectedMidi]);

  useEffect(() => {
    seqRef.current!.setPattern(pattern);
  }, [pattern]);

  useEffect(() => {
    seqRef.current!.setAudible(audible);
  }, [audible]);

  useEffect(() => {
    // Master-volymen är global (Bank-nivå, inte Pattern-nivå) så att den inte
    // hoppar när man bytt slot.
    setMasterVolumeDb(bank.masterDb ?? 0);
  }, [bank.masterDb]);

  useEffect(() => {
    const id = window.setTimeout(() => saveBank(bank), 500);
    return () => window.clearTimeout(id);
  }, [bank]);

  useEffect(() => {
    // Prenumerera på alla port-ändringar (hot-plug: enhet kopplas in/ur).
    // subscribeMidiPorts triggar en initial fetch plus varje gång
    // MIDIAccess.statechange skjuts.
    let active = true;
    const refresh = () => {
      void getMidiOutputs().then((outs) => {
        if (active) setMidiOuts(outs);
      });
      void getMidiInputs().then((ins) => {
        if (active) setMidiIns(ins);
      });
    };
    const unsub = subscribeMidiPorts(refresh);
    refresh();
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // När vi byter till extern klocka: stäng av "Clock ut" (feedback-skydd)
  // och nollställ extern BPM-indikator.
  useEffect(() => {
    if (clockSource === 'external') {
      setClockOutEnabled(false);
    } else {
      // Tillbaka till intern: släpp extern tempo-override
      seqRef.current!.setExternalTempo(null);
      setExternalBpm(null);
      setExternalListening(false);
    }
  }, [clockSource]);

  // Aktiv extern clock-lyssning. Start/Stop från master triggar sekvensen.
  useEffect(() => {
    if (clockSource !== 'external' || !externalListening) return;
    if (midiIns.length === 0) return;

    const handle = listenMidiClock(
      midiIns.map((m) => m.port),
      {
        onTempo: (bpm) => {
          seqRef.current!.setExternalTempo(bpm);
          setExternalBpm(bpm);
        },
        onStart: () => {
          barCountRef.current = 0;
          // async start fire-and-forget; Tone.start är redan körd vid arm
          void seqRef.current!.start();
          setPlaying(true);
        },
        onContinue: () => {
          void seqRef.current!.start();
          setPlaying(true);
        },
        onStop: () => {
          seqRef.current!.stop();
          if (midiRef.current) {
            for (const t of pattern.tracks) panicMidi(midiRef.current.port, t.midiChannel);
          }
          setPlaying(false);
        },
      },
    );
    return () => handle.stop();
  }, [clockSource, externalListening, midiIns, pattern.tracks]);

  const togglePlay = useCallback(async () => {
    if (clockSource === 'external') {
      // Externt läge: play-knappen armar/avarmar lyssning.
      // Själva start/stop triggas av inkommande 0xFA/0xFC.
      if (externalListening) {
        setExternalListening(false);
        seqRef.current!.stop();
        if (midiRef.current) {
          for (const t of pattern.tracks) panicMidi(midiRef.current.port, t.midiChannel);
        }
        setPlaying(false);
      } else {
        // Lås upp audio nu (kräver user gesture) så vi kan spela direkt när
        // external Start kommer.
        await Tone.start();
        seqRef.current!.setExternalTempo(externalBpm);
        setExternalListening(true);
      }
      return;
    }

    if (playing) {
      seqRef.current!.stop();
      if (midiRef.current) {
        for (const t of pattern.tracks) panicMidi(midiRef.current.port, t.midiChannel);
      }
      setPlaying(false);
      setQueuedSlot(null);
    } else {
      barCountRef.current = 0;
      if (bankRef.current.songMode) {
        setSongIndex(0);
        songIndexRef.current = 0;
        const first = bankRef.current.song[0];
        if (first && bankRef.current.slots[first] && bankRef.current.activeSlot !== first) {
          setBankSilent(setActiveSlot(bankRef.current, first));
        }
      }
      await seqRef.current!.start();
      setPlaying(true);
    }
  }, [playing, pattern.tracks, clockSource, externalListening, externalBpm, setBankSilent]);

  const updatePattern = useCallback(
    (next: Pattern | ((p: Pattern) => Pattern)) => {
      setBank((b) => {
        const cur = getActivePattern(b);
        const nextP = typeof next === 'function' ? (next as (p: Pattern) => Pattern)(cur) : next;
        return setActivePattern(b, nextP);
      });
    },
    [setBank],
  );

  const onChangeActiveTrack = useCallback(
    (fn: (t: Track) => Track) => updatePattern((p) => updateActiveTrack(p, fn)),
    [updatePattern],
  );

  const onChangeTrackById = useCallback(
    (id: string, patch: Partial<Track>) => updatePattern((p) => updateTrackById(p, id, patch)),
    [updatePattern],
  );

  const onSelectTrack = useCallback(
    (id: string) => updatePattern((p) => ({ ...p, activeTrackId: id })),
    [updatePattern],
  );

  const onAddTrack = useCallback(() => updatePattern(addTrack), [updatePattern]);
  const onRemoveTrack = useCallback(
    (id: string) => updatePattern((p) => removeTrack(p, id)),
    [updatePattern],
  );

  const onStyle = useCallback(
    (style: StyleName) => updatePattern((p) => applyStyleToActive(p, style)),
    [updatePattern],
  );
  const onRandomizePattern = useCallback(
    (style: StyleName) => updatePattern((p) => randomizePatternByStyle(p, style)),
    [updatePattern],
  );
  const onMutate = useCallback(() => updatePattern((p) => mutateActiveTrack(p, 0.25)), [updatePattern]);
  const onRandomizePitch = useCallback(
    () => updatePattern((p) => randomizeActivePitch(p)),
    [updatePattern],
  );
  const onClearGates = useCallback(() => updatePattern(clearActiveGates), [updatePattern]);
  const onAllGates = useCallback(() => updatePattern(allActiveGates), [updatePattern]);
  const onEuclidean = useCallback(
    (pulses: number) => updatePattern((p) => applyEuclideanToActive(p, pulses)),
    [updatePattern],
  );
  const onRotate = useCallback(
    (offset: number) => updatePattern((p) => rotateActiveTrack(p, offset)),
    [updatePattern],
  );
  const onResetRotation = useCallback(
    () => updatePattern(resetRotationActiveTrack),
    [updatePattern],
  );
  const onOctave = useCallback(
    (delta: number) => updatePattern((p) => shiftOctaveActiveTrack(p, delta)),
    [updatePattern],
  );
  const onResetOctave = useCallback(
    () => updatePattern(resetOctaveActiveTrack),
    [updatePattern],
  );
  const onResize = useCallback(
    (pitchLen: number, gateLen: number) =>
      updatePattern((p) => resizeActiveTrack(p, pitchLen, gateLen)),
    [updatePattern],
  );
  const onChangeLfo = useCallback(
    (patch: Partial<TrackLfo>) =>
      updatePattern((p) => updateActiveTrack(p, (t) => ({ ...t, lfo: { ...t.lfo, ...patch } }))),
    [updatePattern],
  );

  const onChangeVelocityJitter = useCallback(
    (v: number) =>
      updatePattern((p) => updateActiveTrack(p, (t) => ({ ...t, velocityJitter: v }))),
    [updatePattern],
  );

  const onChangeFx = useCallback(
    (patch: Partial<TrackFx>) =>
      updatePattern((p) =>
        updateActiveTrack(p, (t) => ({
          ...t,
          fx: {
            delay: patch.delay ?? t.fx?.delay ?? 0,
            reverb: patch.reverb ?? t.fx?.reverb ?? 0,
            saturation: patch.saturation ?? t.fx?.saturation ?? 0,
          },
        })),
      ),
    [updatePattern],
  );

  const onMasterDbChange = useCallback(
    (v: number) => setBank((b) => ({ ...b, masterDb: v })),
    [setBank],
  );

  const onCopyPitch = useCallback(() => {
    const clip = copyActiveRow(pattern, 'pitch');
    if (clip) setClipboard(clip);
  }, [pattern]);

  const onCopyGate = useCallback(() => {
    const clip = copyActiveRow(pattern, 'gate');
    if (clip) setClipboard(clip);
  }, [pattern]);

  const onPasteRow = useCallback(() => {
    if (!clipboard) return;
    updatePattern((p) => pasteRowToActive(p, clipboard));
  }, [clipboard, updatePattern]);

  const onHumanizeNudge = useCallback(
    (amount: number) => updatePattern((p) => humanizeNudgeActive(p, amount)),
    [updatePattern],
  );
  const onResetNudge = useCallback(
    () => updatePattern(resetNudgeActive),
    [updatePattern],
  );

  const onChord = useCallback(
    (midis: number[], dir: ArpDirection) =>
      updatePattern((p) => applyChordToActive(p, midis, dir)),
    [updatePattern],
  );

  const onMidiImport = useCallback(
    (file: ImportedFile, track: ImportedTrack, quant: QuantResolution) =>
      updatePattern((p) => importTrackToActive(p, track, file.bpm, quant)),
    [updatePattern],
  );

  const onSelectSlot = useCallback(
    (id: SlotId) => {
      setBank((b) => {
        if (b.activeSlot === id && b.slots[id]) return b;
        if (playing && syncMode === 'nextBar' && b.slots[id]) {
          setQueuedSlot(id);
          return b;
        }
        return setActiveSlot(b, id);
      });
    },
    [playing, syncMode, setBank],
  );

  const onClearSlot = useCallback(
    (id: SlotId) => {
      setBank((b) => clearSlot(b, id));
      setQueuedSlot((q) => (q === id ? null : q));
    },
    [setBank],
  );

  const onExport = useCallback(
    (customName: string | null) => downloadBankFile(bank, customName),
    [bank],
  );

  const onExportMidi = useCallback(
    (bars: number, customName: string | null) =>
      downloadPatternAsMidi(pattern, { bars, fileName: customName, randomize: false }),
    [pattern],
  );

  const onImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const imported = importBankJson(text);
        if (imported) {
          // Import nollar historiken — annars kan användaren "ångra" sig tillbaka
          // till föregående bank vilket vore förvirrande.
          setBankSilent(imported);
          setQueuedSlot(null);
          setSongIndex(0);
        } else {
          alert('Kunde inte läsa JSON-filen – fel format?');
        }
      };
      reader.readAsText(file);
    },
    [setBankSilent],
  );

  const onToggleSongMode = useCallback(() => {
    setBank((b) => ({ ...b, songMode: !b.songMode }));
    setSongIndex(0);
  }, [setBank]);

  const onSetSongStep = useCallback(
    (index: number, slot: SlotId) => {
      setBank((b) => {
        if (!b.slots[slot]) return b;
        const song = b.song.slice();
        song[index] = slot;
        return { ...b, song };
      });
    },
    [setBank],
  );

  const onAddSongStep = useCallback(() => {
    setBank((b) => {
      const last = b.song[b.song.length - 1] ?? b.activeSlot;
      return { ...b, song: [...b.song, last] };
    });
  }, [setBank]);

  const onRemoveSongStep = useCallback(
    (index: number) => {
      setBank((b) => {
        if (b.song.length <= 1) return b;
        const song = b.song.filter((_, i) => i !== index);
        return { ...b, song };
      });
      setSongIndex((i) => (i >= index && i > 0 ? i - 1 : i));
    },
    [setBank],
  );

  const onJumpSongStep = useCallback(
    (index: number) => {
      if (!bankRef.current.songMode) return;
      const slot = bankRef.current.song[index];
      if (!slot || !bankRef.current.slots[slot]) return;
      songIndexRef.current = index;
      setSongIndex(index);
      setBankSilent(setActiveSlot(bankRef.current, slot));
    },
    [setBankSilent],
  );

  const activeTrack = pattern.tracks.find((t) => t.id === pattern.activeTrackId) ?? pattern.tracks[0];
  const activeSteps = currentSteps[activeTrack.id] ?? { pitch: -1, gate: -1 };

  // --- Tangent-shortcuts -----------------------------------------------------
  // Vi läser alltid senaste värdena via refs så vi inte behöver re-binda
  // listenern vid varje tangenttryck.
  const togglePlayRef = useRef(togglePlay);
  useEffect(() => {
    togglePlayRef.current = togglePlay;
  }, [togglePlay]);
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  }, [undo, redo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Låt fokus på input/select/textarea/contenteditable sköta sin egen
      // tangentlogik — annars kan man inte skriva ett filnamn eller ändra
      // ett fält utan att shortcut-systemet slukar inputen.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          // Cmd/Ctrl+Z är special: den ska fungera för textfält själv (inbyggt)
          // men space ska absolut inte trigga play när man står i tempo-fältet.
          return;
        }
      }

      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key;

      // Cmd/Ctrl+Z — ångra, Cmd/Ctrl+Shift+Z (eller Cmd+Y) — gör om
      if (cmd && (k === 'z' || k === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
        return;
      }
      if (cmd && (k === 'y' || k === 'Y')) {
        e.preventDefault();
        redoRef.current();
        return;
      }

      // Resten är utan modifier
      if (cmd || e.altKey) return;

      if (k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        void togglePlayRef.current();
        return;
      }

      // 1-8 → byt slot A-H
      if (k >= '1' && k <= '8') {
        const idx = parseInt(k, 10) - 1;
        const slot = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const)[idx];
        if (slot) {
          e.preventDefault();
          onSelectSlot(slot);
        }
        return;
      }

      // Q = mute toggle aktivt spår, W = solo toggle
      if (k === 'q' || k === 'Q') {
        e.preventDefault();
        onChangeTrackById(activeTrack.id, { enabled: !activeTrack.enabled });
        return;
      }
      if (k === 'w' || k === 'W') {
        e.preventDefault();
        onChangeTrackById(activeTrack.id, { solo: !activeTrack.solo });
        return;
      }

      // Z = föregående spår, X = nästa spår
      if (k === 'z' || k === 'Z') {
        e.preventDefault();
        const idx = pattern.tracks.findIndex((t) => t.id === pattern.activeTrackId);
        const prev = pattern.tracks[(idx - 1 + pattern.tracks.length) % pattern.tracks.length];
        if (prev) onSelectTrack(prev.id);
        return;
      }
      if (k === 'x' || k === 'X') {
        e.preventDefault();
        const idx = pattern.tracks.findIndex((t) => t.id === pattern.activeTrackId);
        const next = pattern.tracks[(idx + 1) % pattern.tracks.length];
        if (next) onSelectTrack(next.id);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeTrack.id,
    activeTrack.enabled,
    activeTrack.solo,
    pattern.tracks,
    pattern.activeTrackId,
    onSelectSlot,
    onChangeTrackById,
    onSelectTrack,
  ]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <h1>{APP_META.name}</h1>
          <button
            className="btn btn--manual"
            onClick={() => setManualOpen(true)}
            title="Öppna manualen (Esc för att stänga)"
          >
            📖 Manual
          </button>
        </div>
        <Transport
          playing={playing}
          onTogglePlay={togglePlay}
          tempo={pattern.tempo}
          onTempoChange={(v) => updatePattern((p) => ({ ...p, tempo: v }))}
          swing={pattern.swing}
          onSwingChange={(v) => updatePattern((p) => ({ ...p, swing: v }))}
          audible={audible}
          onAudibleChange={setAudible}
          fillActive={pattern.fillActive}
          onFillChange={(v) => updatePattern((p) => ({ ...p, fillActive: v }))}
          clockOut={clockOutEnabled}
          onClockOutChange={setClockOutEnabled}
          clockOutAvailable={!!selectedMidi}
          clockSource={clockSource}
          onClockSourceChange={setClockSource}
          externalBpm={externalBpm}
          externalListening={externalListening}
          externalInputAvailable={midiIns.length > 0}
          masterDb={bank.masterDb ?? 0}
          onMasterDbChange={onMasterDbChange}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
      </header>

      <div className="zone zone--global">
        <div className="zone__header">
          <span className="zone__icon" aria-hidden>🌍</span>
          <h2 className="zone__title">Global</h2>
          <span className="zone__sub">påverkar hela låten</span>
        </div>

        <section className="panel panel--keyscale">
          <KeyScale
            root={pattern.rootNote}
            scale={pattern.scale}
            baseOctave={pattern.baseOctave}
            onRoot={(v) => updatePattern((p) => ({ ...p, rootNote: v }))}
            onScale={(v) => updatePattern((p) => ({ ...p, scale: v }))}
            onOctave={(v) => updatePattern((p) => ({ ...p, baseOctave: v }))}
          />
          <MidiPicker outputs={midiOuts} selectedId={selectedMidiId} onSelect={setSelectedMidiId} />
        </section>

        <section className="panel panel--diag">
          <details className="panel__collapse">
            <summary className="panel__summary">
              🔧 MIDI-diagnostik
              <span className="panel__summarySub">
                portar · live-LEDs · test-signaler
              </span>
            </summary>
            <MidiDiagnostics
              inputs={midiIns}
              outputs={midiOuts}
              selectedOutId={selectedMidiId}
              defaultChannel={1}
            />
          </details>
        </section>

        <section className="panel panel--bank">
          <PatternBank
            bank={bank}
            queuedSlot={queuedSlot}
            syncMode={syncMode}
            onSyncModeChange={setSyncMode}
            onSelectSlot={onSelectSlot}
            onClearSlot={onClearSlot}
            onExport={onExport}
            onExportMidi={onExportMidi}
            onImportFile={onImportFile}
          />
        </section>

        <section className="panel panel--song">
          <SongChain
            bank={bank}
            songIndex={songIndex}
            onToggleMode={onToggleSongMode}
            onSetStep={onSetSongStep}
            onAddStep={onAddSongStep}
            onRemoveStep={onRemoveSongStep}
            onJumpTo={onJumpSongStep}
          />
        </section>
      </div>

      <div className="zone zone--track">
        <div className="zone__header">
          <span className="zone__icon" aria-hidden>🎛</span>
          <h2 className="zone__title">
            Aktivt spår: <strong>{activeTrack.name}</strong>
          </h2>
          <span className="zone__sub">per-spår parametrar (klicka ett spår för att byta)</span>
        </div>

        <section className="panel panel--trackstrip">
          <TrackStrip
            pattern={pattern}
            onSelect={onSelectTrack}
            onChangeTrack={onChangeTrackById}
            onAdd={onAddTrack}
            onRemove={onRemoveTrack}
          />
        </section>

        <section className="panel panel--chord">
          <ChordInput activeTrackName={activeTrack.name} onChord={onChord} />
          <MidiImport activeTrackName={activeTrack.name} onImport={onMidiImport} />
        </section>

        <section className="panel panel--tools">
          <StylePresets onApply={onStyle} onRandomize={onRandomizePattern} />
          <Tools
            activeTrackName={activeTrack.name}
            activeVoice={activeTrack.voice}
            pitchLength={activeTrack.pitchSteps.length}
            gateLength={activeTrack.gateSteps.length}
            rotation={activeTrack.rotation}
            octaveShift={activeTrack.octaveShift}
            lfo={activeTrack.lfo}
            velocityJitter={activeTrack.velocityJitter ?? 0}
            fx={activeTrack.fx ?? { delay: 0, reverb: 0, saturation: 0 }}
            onResize={onResize}
            onMutate={onMutate}
            onRandomizePitch={onRandomizePitch}
            onClearGates={onClearGates}
            onAllGates={onAllGates}
            onEuclidean={onEuclidean}
            onRotate={onRotate}
            onResetRotation={onResetRotation}
            onOctave={onOctave}
            onResetOctave={onResetOctave}
            onChangeLfo={onChangeLfo}
            onChangeVelocityJitter={onChangeVelocityJitter}
            onHumanizeNudge={onHumanizeNudge}
            onResetNudge={onResetNudge}
            onChangeFx={onChangeFx}
          />
        </section>

        <section className={`panel panel--steps panel--steps--${stepDetail}`}>
          <div className="panel__context">
            <span className="panel__context-arrow">→</span>
            <span className="panel__context-name">{activeTrack.name}</span>
            <span className="panel__context-hint">
              pitch {activeTrack.pitchSteps.length} · gate {activeTrack.gateSteps.length}
              {activeTrack.pitchSteps.length !== activeTrack.gateSteps.length ? ' · polymeter' : ''}
            </span>
            <div className="segment segment--detail" title="Visa kompakt (pitch+gate samtidigt) eller detaljerat (alla per-steg-reglage)">
              <button
                className={`segment__btn ${stepDetail === 'compact' ? 'is-on' : ''}`}
                onClick={() => setStepDetail('compact')}
              >
                Kompakt
              </button>
              <button
                className={`segment__btn ${stepDetail === 'detailed' ? 'is-on' : ''}`}
                onClick={() => setStepDetail('detailed')}
              >
                Detaljerat
              </button>
            </div>
            <QuickActions
              onClearGates={onClearGates}
              onAllGates={onAllGates}
              onRandomizePitch={onRandomizePitch}
              onMutate={onMutate}
              onCopyPitch={onCopyPitch}
              onCopyGate={onCopyGate}
              onPaste={onPasteRow}
              clipboard={clipboard}
            />
          </div>
          <StepEditor
            pattern={pattern}
            track={activeTrack}
            pitchCurrent={activeSteps.pitch}
            gateCurrent={activeSteps.gate}
            detailMode={stepDetail}
            onChangeTrack={onChangeActiveTrack}
          />
        </section>
      </div>

      <footer className="app__footer">
        <small>
          Tips: skapa en IAC-buss i macOS (Audio MIDI Setup → IAC Driver) och välj den som MIDI Ut
          för att styra Logic. Varje spår skickar på sin egen kanal. Banken sparas automatiskt i
          webbläsaren.
        </small>
        <small className="app__copyright">
          © {APP_META.year} {APP_META.owner} · {APP_META.name} v{APP_META.version} ·{' '}
          <button className="link" onClick={() => setManualOpen(true)}>
            Öppna manual
          </button>
        </small>
      </footer>

      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

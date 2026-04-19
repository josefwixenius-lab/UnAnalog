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
  humanizeNudgeActive,
  mutateActiveTrack,
  randomizeActivePitch,
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
import type { ArpDirection } from './engine/patterns';
import {
  getMidiInputs,
  getMidiOutputs,
  listenMidiClock,
  panicMidi,
  sendMidiClockPulse,
  sendMidiNote,
  sendMidiStart,
  sendMidiStop,
} from './engine/midi';
import type { MidiIn, MidiOut } from './engine/midi';
import * as Tone from 'tone';
import type { Pattern, StyleName, Track, TrackLfo } from './engine/types';
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
import { PitchTrack } from './components/PitchTrack';
import { GateTrack } from './components/GateTrack';
import { Tools } from './components/Tools';
import { MidiPicker } from './components/MidiPicker';
import { StylePresets } from './components/StylePresets';
import { TrackStrip } from './components/TrackStrip';
import { PatternBank, type SyncMode } from './components/PatternBank';
import { SongChain } from './components/SongChain';
import { ChordInput } from './components/ChordInput';
import { MidiImport } from './components/MidiImport';
import { Manual } from './components/Manual';
import { importTrackToActive } from './engine/midiImport';
import { downloadPatternAsMidi } from './engine/midiExport';
import type { ImportedFile, ImportedTrack, QuantResolution } from './engine/midiImport';
import { APP_META } from './meta';

export default function App() {
  const [bank, setBank] = useState<Bank>(() => loadBank() ?? emptyBank());
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
          setBank((cur) => setActiveSlot(cur, first));
        }
      }
      await seqRef.current!.start();
      setPlaying(true);
    }
  }, [playing, pattern.tracks, clockSource, externalListening, externalBpm]);

  const updatePattern = useCallback((next: Pattern | ((p: Pattern) => Pattern)) => {
    setBank((b) => {
      const cur = getActivePattern(b);
      const nextP = typeof next === 'function' ? (next as (p: Pattern) => Pattern)(cur) : next;
      return setActivePattern(b, nextP);
    });
  }, []);

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
    [playing, syncMode],
  );

  const onClearSlot = useCallback((id: SlotId) => {
    setBank((b) => clearSlot(b, id));
    setQueuedSlot((q) => (q === id ? null : q));
  }, []);

  const onExport = useCallback(
    (customName: string | null) => downloadBankFile(bank, customName),
    [bank],
  );

  const onExportMidi = useCallback(
    (bars: number, customName: string | null) =>
      downloadPatternAsMidi(pattern, { bars, fileName: customName, randomize: false }),
    [pattern],
  );

  const onImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const imported = importBankJson(text);
      if (imported) {
        setBank(imported);
        setQueuedSlot(null);
        setSongIndex(0);
      } else {
        alert('Kunde inte läsa JSON-filen – fel format?');
      }
    };
    reader.readAsText(file);
  }, []);

  const onToggleSongMode = useCallback(() => {
    setBank((b) => ({ ...b, songMode: !b.songMode }));
    setSongIndex(0);
  }, []);

  const onSetSongStep = useCallback((index: number, slot: SlotId) => {
    setBank((b) => {
      if (!b.slots[slot]) return b;
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

  const onRemoveSongStep = useCallback((index: number) => {
    setBank((b) => {
      if (b.song.length <= 1) return b;
      const song = b.song.filter((_, i) => i !== index);
      return { ...b, song };
    });
    setSongIndex((i) => (i >= index && i > 0 ? i - 1 : i));
  }, []);

  const onJumpSongStep = useCallback((index: number) => {
    if (!bankRef.current.songMode) return;
    const slot = bankRef.current.song[index];
    if (!slot || !bankRef.current.slots[slot]) return;
    songIndexRef.current = index;
    setSongIndex(index);
    setBank((cur) => setActiveSlot(cur, slot));
  }, []);

  const activeTrack = pattern.tracks.find((t) => t.id === pattern.activeTrackId) ?? pattern.tracks[0];
  const activeSteps = currentSteps[activeTrack.id] ?? { pitch: -1, gate: -1 };

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

        <section className="panel panel--steps">
          <div className="panel__context">
            <span className="panel__context-arrow">→</span>
            <span className="panel__context-name">{activeTrack.name}</span>
            <span className="panel__context-hint">
              pitch {activeTrack.pitchSteps.length} · gate {activeTrack.gateSteps.length}
              {activeTrack.pitchSteps.length !== activeTrack.gateSteps.length ? ' · polymeter' : ''}
            </span>
          </div>
          <PitchTrack
            pattern={pattern}
            track={activeTrack}
            currentStep={activeSteps.pitch}
            onChangeTrack={onChangeActiveTrack}
          />
          <GateTrack
            track={activeTrack}
            currentStep={activeSteps.gate}
            onChangeTrack={onChangeActiveTrack}
          />
        </section>

        <section className="panel panel--tools">
          <StylePresets onApply={onStyle} />
          <Tools
            activeTrackName={activeTrack.name}
            activeVoice={activeTrack.voice}
            pitchLength={activeTrack.pitchSteps.length}
            gateLength={activeTrack.gateSteps.length}
            rotation={activeTrack.rotation}
            octaveShift={activeTrack.octaveShift}
            lfo={activeTrack.lfo}
            velocityJitter={activeTrack.velocityJitter ?? 0}
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
          />
        </section>

        <section className="panel panel--chord">
          <ChordInput activeTrackName={activeTrack.name} onChord={onChord} />
          <MidiImport activeTrackName={activeTrack.name} onImport={onMidiImport} />
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

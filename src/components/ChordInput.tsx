import { useCallback, useEffect, useRef, useState } from 'react';
import { captureChord, captureSequence, getMidiInputs } from '../engine/midi';
import type { MidiIn, SequenceCaptureHandle } from '../engine/midi';
import { midiToName } from '../engine/scales';
import type { ArpDirection } from '../engine/patterns';

type Props = {
  activeTrackName: string;
  onChord: (midis: number[], dir: ArpDirection) => void;
};

const DIRECTIONS: { id: ArpDirection; label: string; hint: string }[] = [
  { id: 'up', label: '↑ Upp', hint: 'lägsta → högsta' },
  { id: 'down', label: '↓ Ner', hint: 'högsta → lägsta' },
  { id: 'random', label: '? Slump', hint: 'slumpad ordning' },
  { id: 'updown', label: '↕ Fram & tillbaka', hint: 'upp och ner, ändtoner upprepas' },
  { id: 'pingpong', label: '⇄ Ping-pong', hint: 'upp och ner, ändtoner repeteras inte' },
  { id: 'stack', label: '▦ Stapla', hint: 'alla toner samtidigt på ett enda steg' },
];

export function ChordInput({ activeTrackName, onChord }: Props) {
  const [inputs, setInputs] = useState<MidiIn[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState<ArpDirection>('up');
  const [armed, setArmed] = useState(false);
  const [held, setHeld] = useState<number[]>([]);
  const [lastChord, setLastChord] = useState<number[]>([]);
  const handleRef = useRef<{ stop: () => void } | null>(null);
  const directionRef = useRef(direction);

  // Sekvensinspelning (ton-för-ton)
  const [seqArmed, setSeqArmed] = useState(false);
  const [seqNotes, setSeqNotes] = useState<number[]>([]);
  const seqHandleRef = useRef<SequenceCaptureHandle | null>(null);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    getMidiInputs()
      .then((ins) => {
        setInputs(ins);
        if (ins.length > 0) setSelectedIds(new Set([ins[0].id]));
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
      onNoteOn: (midi) =>
        setHeld((prev) => (prev.includes(midi) ? prev : [...prev, midi])),
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

  const toggleInput = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const noMidi = inputs.length === 0;

  return (
    <div className="chord group--tools">
      <span className="group__label">
        Ackord-input → {activeTrackName}
      </span>

      <div className="field-row">
        <div className="chord__dir">
          {DIRECTIONS.map((d) => (
            <button
              key={d.id}
              className={`chip chord__dir-btn ${direction === d.id ? 'is-on' : ''}`}
              onClick={() => setDirection(d.id)}
              title={d.hint}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        {noMidi ? (
          <span className="hint">
            Ingen MIDI-ingång hittades. Anslut ett keyboard och ladda om sidan.
          </span>
        ) : (
          <>
            <span className="group__label">MIDI in</span>
            <div className="chord__inputs">
              {inputs.map((i) => (
                <label key={i.id} className="field field--toggle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(i.id)}
                    onChange={() => toggleInput(i.id)}
                  />
                  <span>{i.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <button
          className={`btn ${armed ? 'is-on' : ''}`}
          disabled={noMidi || selectedIds.size === 0 || seqArmed}
          onClick={armed ? stopListening : startListening}
          title="Håll ett ackord – släpp alla toner för att skicka"
        >
          {armed ? '◼ Avbryt' : '◉ Spela ackord'}
        </button>

        <button
          className={`btn ${seqArmed ? 'is-on' : ''}`}
          disabled={noMidi || selectedIds.size === 0 || armed}
          onClick={seqArmed ? cancelSequence : startSequence}
          title="Spela ton för ton i valfri ordning. Paus mellan toner är OK."
        >
          {seqArmed ? '◼ Avbryt' : '🎹 Spela in toner'}
        </button>
      </div>

      {armed && (
        <div className="field-row">
          <span className="hint">
            {held.length === 0
              ? 'Väntar — spela ett ackord…'
              : `Håller: ${held.map(midiToName).join(' · ')}  (släpp för att omvandla)`}
          </span>
        </div>
      )}

      {seqArmed && (
        <div className="field-row chord__seq">
          <span className="hint">
            {seqNotes.length === 0
              ? 'Spela in en ton i taget — ordningen bevaras.'
              : `Inspelat (${seqNotes.length}): ${seqNotes.map(midiToName).join(' → ')}`}
          </span>
          <button
            className="chip"
            onClick={undoLastNote}
            disabled={seqNotes.length === 0}
            title="Ta bort senast inspelade ton"
          >
            ↺ Ångra ton
          </button>
          <button
            className="btn btn--primary"
            onClick={finishSequence}
            disabled={seqNotes.length === 0}
            title="Skicka sekvensen till aktiva spåret"
          >
            ✓ Klart
          </button>
        </div>
      )}

      {!armed && !seqArmed && lastChord.length > 0 && (
        <div className="field-row">
          <span className="hint">
            Senast: {lastChord.map(midiToName).join(' · ')} → {lastChord.length} toner →{' '}
            {stepsForDirection(lastChord.length, direction)} steg
          </span>
        </div>
      )}
    </div>
  );
}

function stepsForDirection(n: number, dir: ArpDirection): number {
  if (n <= 1) return Math.max(1, n);
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

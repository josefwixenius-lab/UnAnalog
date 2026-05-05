import { useEffect, useRef, useState } from 'react';
import {
  degreeToMidi,
  midiToName,
  midiToNearestDegree,
  parseNoteInput,
  scaleLength,
} from '../engine/scales';
import type { ScaleName } from '../engine/types';

export type PitchValue = {
  scaleDegree: number;
  octaveOffset: number;
  semitoneOffset?: number;
};

type Props = {
  value: PitchValue;
  rootNote: number;
  baseOctave: number;
  scale: ScaleName;
  /** Klingande tonen visas inkl. ev. semitoneOffset. */
  className?: string;
  /** Hur mycket extra oktav-kontext man räknar med vid drag (för clamping). */
  octaveRange?: { min: number; max: number };
  onChange: (next: PitchValue) => void;
  /** Visas som tooltip när användaren hovrar utan att dra. */
  title?: string;
};

/**
 * Klick-och-dra eller skriv-tonnamn-redigering av en pitch-tag.
 *
 * Interaktioner:
 * - **Klick** (under 4 px rörelse, under 350 ms): öppnar text-input där man
 *   skriver "C3", "F#4", "1"–"7" eller "Bb"; Enter/blur committar, Esc avbryter.
 * - **Drag vertikalt**: skala-steg upp/ner. ~14 px per steg, oktav-wrap.
 *   Nollar samtidigt ev. semitoneOffset så man landar på en ren skala-ton.
 * - **Shift+drag vertikalt**: kromatiskt offset (±halvtoner) som lagras i
 *   `semitoneOffset`. Bevaras vid skala-byten — passar iPad ("aktivt val
 *   utanför skalan").
 *
 * Visas som klingande ton-namn (t.ex. "C#3"). Out-of-scale-markeras med
 * `is-out-of-scale`-klassen och ett litet `*` i hörnet.
 */
export function PitchInput({
  value,
  rootNote,
  baseOctave,
  scale,
  className = '',
  octaveRange = { min: -2, max: 2 },
  onChange,
  title,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Drag-state lever i en ref så pointer-handlers kan läsa/skriva utan att
  // re-rendra komponenten på varje pointermove (det skulle bli laggigt).
  const dragRef = useRef<{
    startY: number;
    accY: number;
    chromatic: boolean;
    moved: boolean;
    startedAt: number;
    pointerId: number;
  } | null>(null);

  const semitone = value.semitoneOffset ?? 0;
  const midi = degreeToMidi(
    rootNote,
    baseOctave,
    scale,
    value.scaleDegree,
    value.octaveOffset,
    semitone,
  );
  const noteName = midiToName(midi);
  const isOutOfScale = semitone !== 0;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  // Hjälpare: kliv ett skala-steg upp/ner och justera octaveOffset om vi
  // wrappar. Nollar semitoneOffset så användaren snäpper tillbaka in i skalan.
  const stepScale = (delta: number) => {
    const len = scaleLength(scale);
    let nextDeg = value.scaleDegree + delta;
    let nextOct = value.octaveOffset;
    while (nextDeg >= len) {
      nextDeg -= len;
      nextOct += 1;
    }
    while (nextDeg < 0) {
      nextDeg += len;
      nextOct -= 1;
    }
    nextOct = Math.max(octaveRange.min, Math.min(octaveRange.max, nextOct));
    onChange({
      scaleDegree: nextDeg,
      octaveOffset: nextOct,
      // semitoneOffset utelämnas → undefined = ren skala-ton
    });
  };

  // Hjälpare: kromatiskt steg (±halvton). Lagras i semitoneOffset utan att
  // röra scaleDegree. Vid stora värden vänder vi över till nästa skala-steg
  // för att inte ackumulera oändligt — ±6 halvtoner är max innan vi snäppar.
  const stepChromatic = (delta: number) => {
    const targetMidi = midi + delta;
    const next = midiToNearestDegree(targetMidi, rootNote, baseOctave, scale);
    const clampedOct = Math.max(
      octaveRange.min,
      Math.min(octaveRange.max, next.octaveOffset),
    );
    onChange({
      scaleDegree: next.scaleDegree,
      octaveOffset: clampedOct,
      semitoneOffset: next.semitoneOffset !== 0 ? next.semitoneOffset : undefined,
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (editing) return;
    // Bara primär knapp — högerklick får visa kontextmeny som vanligt
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      accY: 0,
      chromatic: e.shiftKey,
      moved: false,
      startedAt: Date.now(),
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    // Tröskel innan vi räknar drag — annars kan en darrig klick fyra fel
    if (!d.moved && Math.abs(dy) < 4) return;
    d.moved = true;
    // ~14 px per steg = lagom på desktop, fungerar också på iPad/touch
    const STEP_PX = 14;
    const totalSteps = Math.trunc(dy / STEP_PX);
    const lastSteps = Math.trunc(d.accY / STEP_PX);
    const newSteps = totalSteps - lastSteps;
    if (newSteps !== 0) {
      // Drag upp = höjd ton (negativ dy = uppåt på skärmen)
      const dir = -newSteps;
      d.accY = dy;
      // Shift kan flippas mid-drag — vi läser värdet från eventet
      if (e.shiftKey) {
        stepChromatic(dir);
      } else {
        stepScale(dir);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (!d.moved && Date.now() - d.startedAt < 350) {
      // Klick utan drag → edit-läge
      setEditValue('');
      setEditing(true);
    }
  };

  const commitEdit = (raw: string) => {
    const parsed = parseNoteInput(raw, rootNote, baseOctave, scale, value.octaveOffset);
    if (parsed) {
      onChange({
        scaleDegree: parsed.scaleDegree,
        octaveOffset: Math.max(
          octaveRange.min,
          Math.min(octaveRange.max, parsed.octaveOffset),
        ),
        semitoneOffset:
          parsed.semitoneOffset !== 0 ? parsed.semitoneOffset : undefined,
      });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`pitch-input pitch-input--editing ${className}`}
        type="text"
        defaultValue={noteName}
        placeholder="C3, F#4, 1–7"
        onBlur={(e) => commitEdit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit((e.target as HTMLInputElement).value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (e.shiftKey) stepChromatic(1);
            else stepScale(1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (e.shiftKey) stepChromatic(-1);
            else stepScale(-1);
          }
        }}
        onChange={(e) => setEditValue(e.target.value)}
        value={editValue || undefined}
      />
    );
  }

  return (
    <div
      className={`pitch-input ${isOutOfScale ? 'is-out-of-scale' : ''} ${className}`}
      role="button"
      tabIndex={0}
      title={
        title ??
        `${noteName}${isOutOfScale ? ' (out of scale)' : ''}\nKlick: skriv tonnamn · Dra vertikalt: byt skalsteg · Shift+dra: kromatisk`
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        // Tangentbordsstöd när tag:en har fokus (tab-stop)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditValue('');
          setEditing(true);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (e.shiftKey) stepChromatic(1);
          else stepScale(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (e.shiftKey) stepChromatic(-1);
          else stepScale(-1);
        }
      }}
    >
      <span>{noteName}</span>
      {isOutOfScale && (
        <span className="pitch-input__off" aria-hidden>
          *
        </span>
      )}
    </div>
  );
}

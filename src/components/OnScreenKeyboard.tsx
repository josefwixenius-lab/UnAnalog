import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { Pattern } from '../engine/types';
import type { ArpDirection } from '../engine/patterns';
import { NOTE_NAMES, SCALE_INTERVALS, midiToName } from '../engine/scales';

/**
 * Virtuell pianoklaviatur — mata in toner med musen istället för MIDI-keyboard.
 *
 * Två lägen:
 * - 🎵 Ton för ton: klick lägger ton i en buffer i ordning. När man klickar
 *   "✓ Mata in" skickas hela sekvensen till aktivt spår (samma som MIDI
 *   capture-sekvens). Perfekt för melodier man har i huvudet.
 * - ◉ Ackord: klick lägger till ton i ackord-buffer (dubblar inte). "✓ Mata in"
 *   stackar alla på första pitch-stepet. Perfekt för Cmaj7-ackord på pad.
 *
 * Audition: en intern triangel-PolySynth spelar tonen vid klick så man hör
 * vad man matar in. Anslut till .toDestination() (separat från track-FX-kedjan
 * eftersom det är ett UI-ljud, inte ett spelarljud).
 *
 * Tangenter i aktuell pattern.scale highlightas grönt.
 */

type Mode = 'sequence' | 'chord';

type Props = {
  pattern: Pattern;
  activeTrackName: string;
  /**
   * Tar samma callback som ChordInput. Sequence-läge skickar 'sequence',
   * ackord-läge skickar 'stack' så alla toner hamnar på första stepet.
   */
  onChord: (midis: number[], dir: ArpDirection) => void;
};

// Vilka semitoner som är vita resp. svarta tangenter (relativa C)
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMITONES = [1, 3, 6, 8, 10];
// För varje svart tangent: efter vilken vit-tangent (0–6) den ska ligga
const BLACK_AFTER_WHITE = [0, 1, 3, 4, 5];

const OCTAVES_VISIBLE = 2;

export function OnScreenKeyboard({ pattern, activeTrackName, onChord }: Props) {
  const [octave, setOctave] = useState(pattern.baseOctave);
  const [mode, setMode] = useState<Mode>('sequence');
  const [buffer, setBuffer] = useState<number[]>([]);
  const synthRef = useRef<Tone.PolySynth | null>(null);

  // Audition-synth: intern triangel-PolySynth, ansluten direkt till destination
  // så vi inte krockar med pattern-FX-kedjan. Skapas vid mount, dispose:as
  // vid unmount.
  useEffect(() => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.3, release: 0.45 },
      volume: -12,
    }).toDestination();
    synthRef.current = s;
    return () => {
      s.releaseAll();
      s.disconnect();
      s.dispose();
    };
  }, []);

  const audition = (midi: number) => {
    void Tone.start();
    synthRef.current?.triggerAttackRelease(
      Tone.Frequency(midi, 'midi').toFrequency(),
      0.5,
    );
  };

  const intervals = SCALE_INTERVALS[pattern.scale];

  // Räkna fram alla tangenter att rendera (2 oktaver), separerade i vita/svarta
  // så vi kan absolut-positionera de svarta ovanpå de vita på rätt plats.
  const { whiteKeys, blackKeys } = useMemo(() => {
    const startMidi = (octave + 1) * 12; // C i startoktaven
    const whites: { midi: number; label: string; whiteIdx: number }[] = [];
    const blacks: { midi: number; label: string; afterWhiteIdx: number }[] = [];
    for (let oct = 0; oct < OCTAVES_VISIBLE; oct++) {
      for (let wi = 0; wi < WHITE_SEMITONES.length; wi++) {
        const midi = startMidi + oct * 12 + WHITE_SEMITONES[wi];
        whites.push({
          midi,
          label: NOTE_NAMES[WHITE_SEMITONES[wi]],
          whiteIdx: oct * WHITE_SEMITONES.length + wi,
        });
      }
      for (let bi = 0; bi < BLACK_SEMITONES.length; bi++) {
        const midi = startMidi + oct * 12 + BLACK_SEMITONES[bi];
        const afterIdx = oct * WHITE_SEMITONES.length + BLACK_AFTER_WHITE[bi];
        blacks.push({ midi, label: NOTE_NAMES[BLACK_SEMITONES[bi]], afterWhiteIdx: afterIdx });
      }
    }
    return { whiteKeys: whites, blackKeys: blacks };
  }, [octave]);

  const isInScale = (midi: number) => {
    const rel = (((midi - pattern.rootNote) % 12) + 12) % 12;
    return intervals.includes(rel);
  };

  const handleKeyClick = (midi: number) => {
    audition(midi);
    if (mode === 'chord') {
      // Ackord-läge: dubblera inte samma ton (skulle bara visa upp den, ingen vinst)
      setBuffer((b) => (b.includes(midi) ? b : [...b, midi]));
    } else {
      // Sekvens-läge: ordningen spelar roll, dubletter tillåts (C-E-C-G är giltig)
      setBuffer((b) => [...b, midi]);
    }
  };

  const commit = () => {
    if (buffer.length === 0) return;
    onChord(buffer, mode === 'chord' ? 'stack' : 'sequence');
    setBuffer([]);
  };

  const undoLast = () => setBuffer((b) => b.slice(0, -1));
  const clear = () => setBuffer([]);

  const switchMode = (next: Mode) => {
    if (next !== mode) {
      setMode(next);
      setBuffer([]);
    }
  };

  const totalWhite = whiteKeys.length; // 14 (2 oktaver × 7)

  return (
    <div className="osk">
      <div className="osk__header">
        <h3>🎹 Klaviatur — mata in toner med musen</h3>
        <span className="osk__hint">→ {activeTrackName}</span>
      </div>

      <div className="osk__controls">
        <div className="segment" role="tablist" aria-label="Inmatningsläge">
          <span className="segment__label">Läge</span>
          <button
            role="tab"
            aria-selected={mode === 'sequence'}
            className={`segment__btn ${mode === 'sequence' ? 'is-on' : ''}`}
            onClick={() => switchMode('sequence')}
            title="Klicka tonerna i ordning. Ordningen bevaras, dubbletter räknas."
          >
            🎵 Ton för ton
          </button>
          <button
            role="tab"
            aria-selected={mode === 'chord'}
            className={`segment__btn ${mode === 'chord' ? 'is-on' : ''}`}
            onClick={() => switchMode('chord')}
            title="Klicka flera toner. Stackas på första pitch-stepet som ackord."
          >
            ◉ Ackord
          </button>
        </div>
        <div className="osk__octave" title="Flytta klaviaturen upp eller ner en oktav.">
          <span>Oktav</span>
          <button
            className="tiny"
            onClick={() => setOctave((o) => Math.max(0, o - 1))}
            disabled={octave <= 0}
            aria-label="Oktav ner"
          >
            −
          </button>
          <span className="osk__octave-val">
            C{octave}–B{octave + OCTAVES_VISIBLE - 1}
          </span>
          <button
            className="tiny"
            onClick={() => setOctave((o) => Math.min(7, o + 1))}
            disabled={octave >= 7}
            aria-label="Oktav upp"
          >
            +
          </button>
        </div>
      </div>

      <div
        className="osk__keys"
        style={{ ['--white-count' as string]: totalWhite }}
        role="group"
        aria-label="Pianoklaviatur"
      >
        {whiteKeys.map((k) => (
          <button
            key={`w-${k.midi}`}
            type="button"
            className={`osk__key osk__key--white ${
              isInScale(k.midi) ? 'is-in-scale' : ''
            } ${buffer.includes(k.midi) ? 'is-pressed' : ''}`}
            onClick={() => handleKeyClick(k.midi)}
            title={midiToName(k.midi)}
            aria-label={midiToName(k.midi)}
          >
            <span className="osk__key-label">{k.label}</span>
          </button>
        ))}
        {blackKeys.map((k) => {
          // Centrera svart tangent ovanför gränsen mellan whiteIdx och whiteIdx+1
          const leftPct = ((k.afterWhiteIdx + 1) / totalWhite) * 100;
          return (
            <button
              key={`b-${k.midi}`}
              type="button"
              className={`osk__key osk__key--black ${
                isInScale(k.midi) ? 'is-in-scale' : ''
              } ${buffer.includes(k.midi) ? 'is-pressed' : ''}`}
              style={{ left: `calc(${leftPct}% - 14px)` }}
              onClick={() => handleKeyClick(k.midi)}
              title={midiToName(k.midi)}
              aria-label={midiToName(k.midi)}
            />
          );
        })}
      </div>

      <div className="osk__buffer">
        <span className="osk__buffer-label">
          {mode === 'sequence' ? 'Sekvens' : 'Ackord'} ({buffer.length} st):
        </span>
        <span className="osk__buffer-notes">
          {buffer.length === 0 ? (
            <em>(klicka tangenterna ovan)</em>
          ) : (
            buffer.map((m) => midiToName(m)).join(' · ')
          )}
        </span>
        <div className="osk__buffer-actions">
          <button
            className="chip"
            onClick={undoLast}
            disabled={buffer.length === 0}
            title="Ta bort senaste tonen"
          >
            ↺ Ångra
          </button>
          <button
            className="chip"
            onClick={clear}
            disabled={buffer.length === 0}
            title="Töm buffern"
          >
            Rensa
          </button>
          <button
            className="chip chip--primary"
            onClick={commit}
            disabled={buffer.length === 0}
            title={
              mode === 'sequence'
                ? 'Skicka hela sekvensen till aktivt spårs pitch-rad'
                : 'Stacka alla toner som ackord på första pitch-stepet'
            }
          >
            ✓ Mata in
          </button>
        </div>
      </div>
    </div>
  );
}

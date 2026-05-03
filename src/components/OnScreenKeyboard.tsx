import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { Pattern } from '../engine/types';
import type { ArpDirection } from '../engine/patterns';
import { NOTE_NAMES, SCALE_INTERVALS, SCALE_LABELS, midiToName } from '../engine/scales';

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

/**
 * Storleksval för klaviaturen. Standardiserade hardware-storlekar:
 *  - 2 oktaver = 24 tangenter (mini-controller, kompakt)
 *  - 3 oktaver = 36 tangenter (37-keys-stil)
 *  - 4 oktaver = 48 tangenter (49-keys-stil, default)
 *  - 5 oktaver = 60 tangenter (61-keys-stil)
 * 88-tangenter (~7) får inte plats horisontellt utan scroll, så vi stannar
 * vid 5. Tangenterna är flex:1 så hela bredden fylls oavsett antal oktaver.
 */
const SIZE_OPTIONS: { id: number; label: string; hint: string }[] = [
  { id: 2, label: '25', hint: '2 oktaver — kompakt mini-controller' },
  { id: 3, label: '37', hint: '3 oktaver — klassisk midi-controller' },
  { id: 4, label: '49', hint: '4 oktaver — fyller en hel synthwave-loop' },
  { id: 5, label: '61', hint: '5 oktaver — bas till lead på en gång' },
];

const DEFAULT_OCTAVES_VISIBLE = 4;

export function OnScreenKeyboard({ pattern, activeTrackName, onChord }: Props) {
  // Default startoctav justerad nedåt om många oktaver visas så bas-tonerna
  // syns från start (en 5-oktavers default på baseOctave skulle hamna högt
  // upp och dölja basområdet).
  const [octavesVisible, setOctavesVisible] = useState<number>(
    DEFAULT_OCTAVES_VISIBLE,
  );
  const [octave, setOctave] = useState(() =>
    Math.max(0, pattern.baseOctave - Math.floor(DEFAULT_OCTAVES_VISIBLE / 2)),
  );
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

  // Räkna fram alla tangenter att rendera, separerade i vita/svarta så vi
  // kan absolut-positionera de svarta ovanpå de vita på rätt plats.
  const { whiteKeys, blackKeys } = useMemo(() => {
    const startMidi = (octave + 1) * 12; // C i startoktaven
    const whites: { midi: number; label: string; whiteIdx: number }[] = [];
    const blacks: { midi: number; label: string; afterWhiteIdx: number }[] = [];
    for (let oct = 0; oct < octavesVisible; oct++) {
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
  }, [octave, octavesVisible]);

  /**
   * Byt antal synliga oktaver. För att inte hamna ovanför MIDI-127 vid
   * stora storlekar klampar vi octave-värdet — t.ex. 5 oktaver på octave=7
   * skulle ligga utanför pianots område, så då sänks startoctav.
   */
  const changeSize = (next: number) => {
    setOctavesVisible(next);
    // Säkerställ att slut-tangenten ligger inom rimligt midi-område (≤127).
    // Sista C är vid (octave + next) * 12 + 1 (B i sista oktaven). Vi vill
    // inte gå över octave=8 totalt, så klampa nedåt.
    setOctave((o) => Math.min(o, Math.max(0, 8 - next)));
  };

  /**
   * Räkna ut scale-degree (1–N) för en MIDI-not, eller null om tonen INTE
   * är i den valda skalan. Rotton = 1, sen kvinten = 5 i en major-skala
   * osv. Användbart för att visa "var i skalan" varje tangent ligger.
   */
  const scaleDegree = (midi: number): number | null => {
    const rel = (((midi - pattern.rootNote) % 12) + 12) % 12;
    const idx = intervals.indexOf(rel);
    return idx >= 0 ? idx + 1 : null;
  };

  const isRoot = (midi: number) => {
    const rel = (((midi - pattern.rootNote) % 12) + 12) % 12;
    return rel === 0;
  };

  // Tonart-text för headern: t.ex. "A Moll" eller "C Pentatonisk dur".
  const keyName = `${NOTE_NAMES[pattern.rootNote]} ${SCALE_LABELS[pattern.scale]}`;

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
        <span className="osk__key-info" title="Aktuell tonart (rotton + skala). Skalans toner highlightas grönt nedan, rotton (1:an) med accentfärg.">
          {keyName}
        </span>
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
        <div
          className="segment"
          role="tablist"
          aria-label="Klaviaturens storlek"
          title="Antal tangenter / oktaver synliga samtidigt."
        >
          <span className="segment__label">Storlek</span>
          {SIZE_OPTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={octavesVisible === s.id}
              className={`segment__btn ${octavesVisible === s.id ? 'is-on' : ''}`}
              onClick={() => changeSize(s.id)}
              title={s.hint}
            >
              {s.label}
            </button>
          ))}
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
            C{octave}–B{octave + octavesVisible - 1}
          </span>
          <button
            className="tiny"
            onClick={() => setOctave((o) => Math.min(8 - octavesVisible, o + 1))}
            disabled={octave >= 8 - octavesVisible}
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
        {whiteKeys.map((k) => {
          const degree = scaleDegree(k.midi);
          const root = isRoot(k.midi);
          // Visa BARA scale-degree på skala-toner (★ för rotton, annars 2-7).
          // Out-of-scale-tangenter renderas helt utan synlig label så
          // klaviaturen håller sig clean och fokuserad på vad som passar.
          const label = degree != null ? (root ? '★' : String(degree)) : null;
          return (
            <button
              key={`w-${k.midi}`}
              type="button"
              className={`osk__key osk__key--white ${
                degree != null ? 'is-in-scale' : ''
              } ${root ? 'is-root' : ''} ${buffer.includes(k.midi) ? 'is-pressed' : ''}`}
              onClick={() => handleKeyClick(k.midi)}
              title={
                degree != null
                  ? `${midiToName(k.midi)} — skalsteg ${degree}${root ? ' (rotton)' : ''}`
                  : `${midiToName(k.midi)} — utanför skalan`
              }
              aria-label={midiToName(k.midi)}
            >
              {label != null && <span className="osk__key-label">{label}</span>}
            </button>
          );
        })}
        {blackKeys.map((k) => {
          // Centrera svart tangent ovanför gränsen mellan whiteIdx och whiteIdx+1.
          // Bredd skalas med antalet vita tangenter — så svarta håller sig
          // proportionerliga oavsett 25/37/49/61-storlek (60% av en vit-bredd).
          const whiteWidthPct = 100 / totalWhite;
          const blackWidthPct = whiteWidthPct * 0.6;
          const leftPct = ((k.afterWhiteIdx + 1) / totalWhite) * 100;
          const degree = scaleDegree(k.midi);
          const root = isRoot(k.midi);
          return (
            <button
              key={`b-${k.midi}`}
              type="button"
              className={`osk__key osk__key--black ${
                degree != null ? 'is-in-scale' : ''
              } ${root ? 'is-root' : ''} ${buffer.includes(k.midi) ? 'is-pressed' : ''}`}
              style={{
                left: `${leftPct - blackWidthPct / 2}%`,
                width: `${blackWidthPct}%`,
              }}
              onClick={() => handleKeyClick(k.midi)}
              title={
                degree != null
                  ? `${midiToName(k.midi)} — skalsteg ${degree}${root ? ' (rotton)' : ''}`
                  : midiToName(k.midi)
              }
              aria-label={midiToName(k.midi)}
            >
              {degree != null && (
                <span className="osk__key-label osk__key-label--black">
                  {root ? '★' : degree}
                </span>
              )}
            </button>
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

import { useState } from 'react';
import type { StyleName } from '../engine/types';

const STYLES: { id: StyleName; label: string; hint: string }[] = [
  { id: 'ambient', label: 'Ambient', hint: 'gles, drömsk — trivs i pentatonisk moll runt 80 BPM' },
  { id: 'acid', label: 'Acid', hint: 'slides & ratchets — trivs i frygisk runt 128 BPM' },
  { id: 'berlin', label: 'Berlin', hint: 'tät & pulsande — trivs i moll runt 115 BPM' },
  { id: 'idm', label: 'IDM', hint: 'euklidisk & polyrytmisk — trivs i dorisk runt 140 BPM' },
  { id: 'chillout', label: 'Chillout', hint: 'mjukt swing — trivs i pentatonisk dur runt 95 BPM' },
];

type Props = {
  onApply: (style: StyleName) => void;
  onRandomize: (style: StyleName) => void;
};

export function StylePresets({ onApply, onRandomize }: Props) {
  const [randomStyle, setRandomStyle] = useState<StyleName>('berlin');

  return (
    <div className="group">
      <span className="group__label">
        Stilpresets — knappen skriver över AKTIVT spår, 🎲 slumpar HELA pattern
      </span>
      <div className="chips">
        {STYLES.map((s) => (
          <button key={s.id} className="chip" title={s.hint} onClick={() => onApply(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="chips chips--random">
        <select
          value={randomStyle}
          onChange={(e) => setRandomStyle(e.target.value as StyleName)}
          className="chip chip--select"
          title="Välj genre för slumpgenerering"
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          className="chip chip--random"
          onClick={() => onRandomize(randomStyle)}
          title="Slumpa helt nytt pattern utifrån vald stil — skriver över ALLA spår, tempo, skala och swing. Klicka igen för nästa idé."
        >
          🎲 Slumpa nytt pattern
        </button>
      </div>
    </div>
  );
}

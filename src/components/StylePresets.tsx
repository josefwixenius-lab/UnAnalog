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
};

export function StylePresets({ onApply }: Props) {
  return (
    <div className="group">
      <span className="group__label">Stilpresets — skriver över aktivt spår, rör inte tempo/skala</span>
      <div className="chips">
        {STYLES.map((s) => (
          <button key={s.id} className="chip" title={s.hint} onClick={() => onApply(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

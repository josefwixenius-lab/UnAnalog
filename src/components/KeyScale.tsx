import { NOTE_NAMES, SCALE_LABELS } from '../engine/scales';
import type { ScaleName } from '../engine/types';

type Props = {
  root: number;
  scale: ScaleName;
  baseOctave: number;
  onRoot: (v: number) => void;
  onScale: (v: ScaleName) => void;
  onOctave: (v: number) => void;
};

export function KeyScale({ root, scale, baseOctave, onRoot, onScale, onOctave }: Props) {
  return (
    <div className="group">
      <label className="field">
        <span>Tonart</span>
        <select value={root} onChange={(e) => onRoot(Number(e.target.value))}>
          {NOTE_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Skala</span>
        <select value={scale} onChange={(e) => onScale(e.target.value as ScaleName)}>
          {(Object.keys(SCALE_LABELS) as ScaleName[]).map((s) => (
            <option key={s} value={s}>
              {SCALE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Oktav</span>
        <input
          type="number"
          min={1}
          max={6}
          value={baseOctave}
          onChange={(e) => onOctave(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

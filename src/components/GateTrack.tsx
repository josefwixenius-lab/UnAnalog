import type { GateStep, Track, TrigCondition } from '../engine/types';

type Props = {
  track: Track;
  currentStep: number;
  onChangeTrack: (updater: (t: Track) => Track) => void;
};

export function GateTrack({ track, currentStep, onChangeTrack }: Props) {
  const updateStep = (i: number, patch: Partial<GateStep>) => {
    onChangeTrack((t) => {
      const next = t.gateSteps.slice();
      next[i] = { ...next[i], ...patch };
      return { ...t, gateSteps: next };
    });
  };

  return (
    <div className="track track--gate">
      <div className="track__header">
        <h2 style={{ color: track.color }}>Gate · {track.name}</h2>
        <span className="muted">{track.gateSteps.length} steg</span>
      </div>
      <div className="steps">
        {track.gateSteps.map((g, i) => {
          const playing = i === currentStep;
          const hasCondition = g.condition !== 'always';
          const probPct = Math.round(g.probability * 100);
          const velPct = Math.round(g.velocity * 100);
          const isProbLow = g.probability < 1;
          const nudgePct = Math.round((g.nudge ?? 0) * 100);
          const isNudged = (g.nudge ?? 0) !== 0;
          return (
            <div
              key={i}
              className={`step step--gate ${g.active ? 'is-active' : ''} ${playing ? 'is-playing' : ''} ${hasCondition ? 'has-condition' : ''} ${g.filterLock != null ? 'has-plock' : ''} ${isProbLow ? 'is-prob-low' : ''} ${isNudged ? 'is-nudged' : ''}`}
              style={
                isNudged
                  ? { transform: `translateX(${(g.nudge ?? 0) * 12}px)` }
                  : undefined
              }
            >
              <button
                className="step__trigger"
                onClick={() => updateStep(i, { active: !g.active })}
                title="Aktiv"
              >
                {g.active ? '●' : '○'}
              </button>
              <select
                className="step__condition"
                value={g.condition}
                onChange={(e) => updateStep(i, { condition: e.target.value as TrigCondition })}
                title="Villkor"
              >
                <option value="always">alltid</option>
                <optgroup label="prob">
                  <option value="p25">25%</option>
                  <option value="p50">50%</option>
                  <option value="p75">75%</option>
                </optgroup>
                <optgroup label="cykel">
                  <option value="1:2">1:2</option>
                  <option value="2:2">2:2</option>
                  <option value="1:3">1:3</option>
                  <option value="2:3">2:3</option>
                  <option value="3:3">3:3</option>
                  <option value="1:4">1:4</option>
                  <option value="2:4">2:4</option>
                  <option value="3:4">3:4</option>
                  <option value="4:4">4:4</option>
                </optgroup>
                <optgroup label="kedja">
                  <option value="prev">efter träff</option>
                  <option value="notPrev">efter miss</option>
                </optgroup>
                <optgroup label="fill">
                  <option value="fill">under FILL</option>
                  <option value="notFill">ej FILL</option>
                </optgroup>
              </select>
              <label className="step__mini" title="Gate-längd">
                <span>gate</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={g.gate}
                  onChange={(e) => updateStep(i, { gate: Number(e.target.value) })}
                />
              </label>
              <label className="step__mini step__mini--prob" title={`Sannolikhet att steget spelar: ${probPct}%`}>
                <span>🎲 {probPct}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={g.probability}
                  onChange={(e) => updateStep(i, { probability: Number(e.target.value) })}
                />
              </label>
              <label className="step__mini step__mini--vel" title={`Velocity: ${velPct}%`}>
                <span>vel {velPct}%</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={g.velocity}
                  onChange={(e) => updateStep(i, { velocity: Number(e.target.value) })}
                />
              </label>
              <label
                className="step__mini step__mini--nudge"
                title={`Nudge: ${nudgePct > 0 ? '+' : ''}${nudgePct}% av steget (dubbelklicka för att nollställa)`}
              >
                <span>
                  {isNudged ? (nudgePct > 0 ? `+${nudgePct}` : `${nudgePct}`) : '±0'}%
                </span>
                <input
                  type="range"
                  min={-0.5}
                  max={0.5}
                  step={0.02}
                  value={g.nudge ?? 0}
                  onChange={(e) => updateStep(i, { nudge: Number(e.target.value) })}
                  onDoubleClick={() => updateStep(i, { nudge: 0 })}
                />
              </label>
              <div className="step__ratchet">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    className={`tiny ${g.ratchet === r ? 'is-on' : ''}`}
                    onClick={() => updateStep(i, { ratchet: r })}
                    title={`Ratchet ${r}x`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <label className="step__accent" title="Accent">
                <input
                  type="checkbox"
                  checked={g.accent}
                  onChange={(e) => updateStep(i, { accent: e.target.checked })}
                />
                <span>acc</span>
              </label>
              <div className={`step__plock ${g.filterLock != null ? 'is-on' : ''}`}>
                <button
                  className="tiny"
                  onClick={() =>
                    updateStep(i, { filterLock: g.filterLock == null ? 0.5 : null })
                  }
                  title={g.filterLock == null ? 'L\u00e5s filter p\u00e5 detta steg' : 'Ta bort filterl\u00e5s'}
                >
                  {g.filterLock == null ? 'p-lock' : 'filter'}
                </button>
                {g.filterLock != null && (
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={g.filterLock}
                    onChange={(e) => updateStep(i, { filterLock: Number(e.target.value) })}
                    title={`Filter-cutoff l\u00e5st: ${Math.round(g.filterLock * 100)}%`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

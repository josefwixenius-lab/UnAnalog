import { useState } from 'react';
import type { LfoRate, LfoShape, LfoTarget, TrackLfo, VoiceKind } from '../engine/types';

type Props = {
  activeTrackName: string;
  activeVoice: VoiceKind;
  pitchLength: number;
  gateLength: number;
  rotation: number;
  octaveShift: number;
  lfo: TrackLfo;
  velocityJitter: number;
  onResize: (pitchLen: number, gateLen: number) => void;
  onMutate: () => void;
  onRandomizePitch: () => void;
  onClearGates: () => void;
  onAllGates: () => void;
  onEuclidean: (pulses: number) => void;
  onRotate: (offset: number) => void;
  onResetRotation: () => void;
  onOctave: (delta: number) => void;
  onResetOctave: () => void;
  onChangeLfo: (patch: Partial<TrackLfo>) => void;
  onChangeVelocityJitter: (v: number) => void;
  onHumanizeNudge: (amount: number) => void;
  onResetNudge: () => void;
};

export function Tools({
  activeTrackName,
  activeVoice,
  pitchLength,
  gateLength,
  rotation,
  octaveShift,
  lfo,
  velocityJitter,
  onResize,
  onMutate,
  onRandomizePitch,
  onClearGates,
  onAllGates,
  onEuclidean,
  onRotate,
  onResetRotation,
  onOctave,
  onResetOctave,
  onChangeLfo,
  onChangeVelocityJitter,
  onHumanizeNudge,
  onResetNudge,
}: Props) {
  const [euclid, setEuclid] = useState(5);
  const [humanizeAmount, setHumanizeAmount] = useState(0.08);

  const rotHome = rotation === 0;
  const rotLeftHome = rotHome || rotation > 0;
  const rotRightHome = rotHome || rotation < 0;

  const octHome = octaveShift === 0;
  const octDownHome = octHome || octaveShift > 0;
  const octUpHome = octHome || octaveShift < 0;

  const showOctave = activeVoice !== 'hats';

  return (
    <div className="group group--tools">
      <span className="group__label">Verktyg — påverkar {activeTrackName}</span>

      <div className="field-row">
        <label className="field">
          <span>Pitch-längd</span>
          <input
            type="number"
            min={1}
            max={32}
            value={pitchLength}
            onChange={(e) =>
              onResize(Math.max(1, Math.min(32, Number(e.target.value))), gateLength)
            }
          />
        </label>
        <label className="field">
          <span>Gate-längd</span>
          <input
            type="number"
            min={1}
            max={32}
            value={gateLength}
            onChange={(e) =>
              onResize(pitchLength, Math.max(1, Math.min(32, Number(e.target.value))))
            }
          />
        </label>
        <small className="hint">Olika längder = polymeter. Prova 5 mot 7 eller 7 mot 16.</small>
      </div>

      <div className="field-row">
        <button className="chip" onClick={onMutate}>Mutera 25%</button>
        <button className="chip" onClick={onRandomizePitch}>Slumpa toner</button>
        <button className="chip" onClick={onClearGates}>Rensa gates</button>
        <button className="chip" onClick={onAllGates}>Alla gates på</button>
      </div>

      <div className="field-row">
        <span className="group__label">Rotera</span>
        <button
          className={`chip chip--dir ${rotLeftHome ? 'is-home' : ''}`}
          onClick={() => onRotate(-1)}
          title={rotation > 0 ? 'Gå tillbaka mot utgångsläget' : 'Rotera åt vänster'}
        >
          ←
        </button>
        <span className={`dir-indicator ${rotHome ? 'is-home' : ''}`} title="Rotationsoffset">
          {rotation === 0 ? '●' : rotation > 0 ? `+${rotation}` : `${rotation}`}
        </span>
        <button
          className={`chip chip--dir ${rotRightHome ? 'is-home' : ''}`}
          onClick={() => onRotate(1)}
          title={rotation < 0 ? 'Gå tillbaka mot utgångsläget' : 'Rotera åt höger'}
        >
          →
        </button>
        <button
          className="chip chip--reset"
          onClick={onResetRotation}
          disabled={rotHome}
          title="Återställ till utgångsläget"
        >
          ↺ hem
        </button>

        {showOctave && (
          <>
            <span className="group__label group__label--inline">Oktav</span>
            <button
              className={`chip chip--dir ${octDownHome ? 'is-home' : ''}`}
              onClick={() => onOctave(-1)}
              title={octaveShift > 0 ? 'Tillbaka mot utgångsläget' : 'Oktav ner'}
            >
              −
            </button>
            <span className={`dir-indicator ${octHome ? 'is-home' : ''}`} title="Spårets oktav">
              {octaveShift === 0 ? '●' : octaveShift > 0 ? `+${octaveShift}` : `${octaveShift}`}
            </span>
            <button
              className={`chip chip--dir ${octUpHome ? 'is-home' : ''}`}
              onClick={() => onOctave(1)}
              title={octaveShift < 0 ? 'Tillbaka mot utgångsläget' : 'Oktav upp'}
            >
              +
            </button>
            <button
              className="chip chip--reset"
              onClick={onResetOctave}
              disabled={octHome}
              title="Återställ oktav"
            >
              ↺ hem
            </button>
          </>
        )}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Euklidisk: pulser</span>
          <input
            type="number"
            min={0}
            max={gateLength}
            value={euclid}
            onChange={(e) =>
              setEuclid(Math.max(0, Math.min(gateLength, Number(e.target.value))))
            }
          />
        </label>
        <button className="chip" onClick={() => onEuclidean(euclid)}>
          Fördela {euclid} pulser över {gateLength} steg
        </button>
      </div>

      <div className="field-row field-row--lfo">
        <span className="group__label">LFO</span>
        <label className="field">
          <span>Mål</span>
          <select
            value={lfo.target}
            onChange={(e) => onChangeLfo({ target: e.target.value as LfoTarget })}
          >
            <option value="off">av</option>
            <option value="filter">filter</option>
            <option value="volume">volym</option>
          </select>
        </label>
        <label className="field">
          <span>Rate</span>
          <select
            value={lfo.rate}
            onChange={(e) => onChangeLfo({ rate: e.target.value as LfoRate })}
            disabled={lfo.target === 'off'}
          >
            <option value="16n">1/16</option>
            <option value="8n">1/8</option>
            <option value="4n">1/4</option>
            <option value="2n">1/2</option>
            <option value="1n">1 takt</option>
            <option value="2m">2 takter</option>
            <option value="4m">4 takter</option>
          </select>
        </label>
        <label className="field">
          <span>Form</span>
          <select
            value={lfo.shape}
            onChange={(e) => onChangeLfo({ shape: e.target.value as LfoShape })}
            disabled={lfo.target === 'off'}
          >
            <option value="sine">sinus</option>
            <option value="triangle">triangel</option>
            <option value="square">fyrkant</option>
            <option value="sawtooth">såg</option>
          </select>
        </label>
        <label className="field">
          <span>Djup {Math.round(lfo.depth * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={lfo.depth}
            onChange={(e) => onChangeLfo({ depth: Number(e.target.value) })}
            disabled={lfo.target === 'off'}
          />
        </label>
      </div>

      <div className="field-row field-row--jitter">
        <span className="group__label">Velocity-jitter</span>
        <label className="field">
          <span>Slump ±{Math.round(velocityJitter * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={velocityJitter}
            onChange={(e) => onChangeVelocityJitter(Number(e.target.value))}
            title="Humaniserar velocity per trigger. 0 = exakt, 100% = vilt."
          />
        </label>
        <small className="hint">
          Slumpar velocity ±X% kring inställt värde per spelning. Accent lägger till ovanpå.
        </small>
      </div>

      <div className="field-row field-row--humanize">
        <span className="group__label">Humanize nudge</span>
        <label className="field">
          <span>Styrka ±{Math.round(humanizeAmount * 100)}%</span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={humanizeAmount}
            onChange={(e) => setHumanizeAmount(Number(e.target.value))}
            title="Mängd timing-variation: 0% = på gridden, 50% = ett halvt steg före/efter"
          />
        </label>
        <button
          className="chip"
          onClick={() => onHumanizeNudge(humanizeAmount)}
          title="Slumpa nudge på alla steg inom ±styrkan ovan"
        >
          🎲 Slumpa nudge
        </button>
        <button
          className="chip chip--reset"
          onClick={onResetNudge}
          title="Nollställ all nudge på detta spår"
        >
          ↺ Nollställ
        </button>
        <small className="hint">
          Klicka upprepat för nya varianter. Subtilt: 5–10%. Drunken MPC: 15–25%.
        </small>
      </div>
    </div>
  );
}

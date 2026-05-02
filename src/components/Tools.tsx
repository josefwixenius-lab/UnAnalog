import { useState } from 'react';
import type {
  DelayMode,
  DelaySubdivision,
  LfoRate,
  LfoShape,
  LfoTarget,
  TrackFx,
  TrackLfo,
  VoiceKind,
} from '../engine/types';

type SidechainSource = {
  id: string;
  name: string;
};

const DELAY_TIME_OPTIONS: { id: DelaySubdivision; label: string }[] = [
  { id: '4n', label: '1/4' },
  { id: '8n.', label: '1/8.' },
  { id: '8n', label: '1/8' },
  { id: '8t', label: '1/8T' },
  { id: '16n.', label: '1/16.' },
  { id: '16n', label: '1/16' },
  { id: '16t', label: '1/16T' },
  { id: '32n', label: '1/32' },
];

const DELAY_MODE_OPTIONS: { id: DelayMode; label: string; hint: string }[] = [
  { id: 'pingpong', label: 'Ping-pong', hint: 'Klassisk stereo ping-pong' },
  { id: 'mono', label: 'Mono', hint: 'Enkel mono-feedback (Space Echo-känsla)' },
  { id: 'tape', label: 'Tape', hint: 'Pitch-svaj via LFO på delaytid — vintage tape-vibration' },
];

type Props = {
  activeTrackName: string;
  activeVoice: VoiceKind;
  pitchLength: number;
  gateLength: number;
  rotation: number;
  octaveShift: number;
  lfo: TrackLfo;
  velocityJitter: number;
  fx: TrackFx;
  filterCutoff: number | undefined;
  filterResonance: number | undefined;
  onChangeFilter: (patch: { filterCutoff?: number | null; filterResonance?: number | null }) => void;
  /** Lista över andra spår som kan vara sidechain-källor. */
  sidechainSources: SidechainSource[];
  sidechainSourceId: string | undefined;
  sidechainAmount: number | undefined;
  sidechainRelease: number | undefined;
  onChangeSidechain: (patch: {
    sidechainSourceId?: string | null;
    sidechainAmount?: number;
    sidechainRelease?: number;
  }) => void;
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
  onChangeFx: (patch: Partial<TrackFx>) => void;
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
  fx,
  filterCutoff,
  filterResonance,
  onChangeFilter,
  sidechainSources,
  sidechainSourceId,
  sidechainAmount,
  sidechainRelease,
  onChangeSidechain,
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
  onChangeFx,
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

      <div className="field-row field-row--filter">
        <span className="group__label">Filter</span>
        <label
          className="field"
          title="Cutoff baseline. 0 = mörkt (80 Hz), 1 = ljust (16 kHz). Per-step filter-lock modulerar runt detta värde. Dubbelklicka för voice-default."
        >
          <span>
            Cutoff{' '}
            {filterCutoff == null ? 'voice' : Math.round(filterCutoff * 100) + '%'}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={filterCutoff ?? 0.5}
            onChange={(e) =>
              onChangeFilter({ filterCutoff: Number(e.target.value) })
            }
            onDoubleClick={() => onChangeFilter({ filterCutoff: null })}
          />
        </label>
        <label
          className="field"
          title="Resonans (Q). 0 = neutral, 1 = sjungande. Acid-bas vill ha hög resonans + cutoff-LFO."
        >
          <span>
            Reso{' '}
            {filterResonance == null ? '–' : Math.round(filterResonance * 100) + '%'}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={filterResonance ?? 0}
            onChange={(e) =>
              onChangeFilter({ filterResonance: Number(e.target.value) })
            }
            onDoubleClick={() => onChangeFilter({ filterResonance: null })}
          />
        </label>
        <button
          className="chip chip--reset"
          onClick={() =>
            onChangeFilter({ filterCutoff: null, filterResonance: null })
          }
          disabled={filterCutoff == null && filterResonance == null}
          title="Återställ till voice-default cutoff & neutral resonans"
        >
          ↺ Default
        </button>
      </div>

      <div className="field-row field-row--sidechain">
        <span className="group__label">Sidechain</span>
        <label
          className="field"
          title="Källa: vilket spår triggar pumpen? Klassiskt: bass-spåret pumpar pad/lead. Ingen = av."
        >
          <span>Källa</span>
          <select
            value={sidechainSourceId ?? ''}
            onChange={(e) =>
              onChangeSidechain({ sidechainSourceId: e.target.value || null })
            }
          >
            <option value="">— ingen —</option>
            {sidechainSources.map((s) => (
              <option key={s.id} value={s.id}>
                ↘ {s.name}
              </option>
            ))}
          </select>
        </label>
        <label
          className="field"
          title="Hur djupt detta spår dippas vid varje trigger på källan. 40–70% = klassisk synthwave-pump, 100% = total tystnad i transienten."
        >
          <span>Pump {Math.round((sidechainAmount ?? 0) * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={sidechainAmount ?? 0}
            onChange={(e) =>
              onChangeSidechain({ sidechainAmount: Number(e.target.value) })
            }
            disabled={!sidechainSourceId}
          />
        </label>
        <label
          className="field"
          title="Release-tid: hur länge pumpen håller i sig. Kort (50–100 ms) = snärtigt, långt (300+ ms) = breath/svaj."
        >
          <span>
            Release {Math.round((sidechainRelease ?? 0.18) * 1000)} ms
          </span>
          <input
            type="range"
            min={0.05}
            max={0.5}
            step={0.01}
            value={sidechainRelease ?? 0.18}
            onChange={(e) =>
              onChangeSidechain({ sidechainRelease: Number(e.target.value) })
            }
            disabled={!sidechainSourceId}
          />
        </label>
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

      {(() => {
        // Bakåtkompat: gamla sparade fx-objekt har bara delay/reverb/saturation.
        // Nya optionella fält faller tillbaka på legacy-värden eller defaults.
        const delayMix = fx.delayMix ?? fx.delay;
        const delayTime: DelaySubdivision = fx.delayTime ?? '8n';
        const delayFb = fx.delayFeedback ?? 0.35;
        const delayMode: DelayMode = fx.delayMode ?? 'pingpong';
        const reverbShort = fx.reverbShort ?? 0;
        const reverbLong = fx.reverbLong ?? fx.reverb;
        const reverbPreDelay = fx.reverbPreDelay ?? 0;
        const chorus = fx.chorus ?? 0;
        const chorusRate = fx.chorusRate ?? 1.5;
        const chorusDepth = fx.chorusDepth ?? 0.7;
        const crusher = fx.bitcrusher ?? 0;
        const allDry =
          delayMix === 0 &&
          reverbShort === 0 &&
          reverbLong === 0 &&
          fx.saturation === 0 &&
          chorus === 0 &&
          crusher === 0;
        return (
          <>
            {/* === Delay-grupp === */}
            <div className="field-row field-row--fx">
              <span className="group__label">Delay</span>
              <label className="field" title="Wet-mix mot delay-bussen.">
                <span>Mix {Math.round(delayMix * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={delayMix}
                  onChange={(e) => onChangeFx({ delayMix: Number(e.target.value) })}
                />
              </label>
              <label className="field" title="Tid (musikalisk subdivision). 1/8. = punkterad åttondel, 1/8T = triol.">
                <span>Tid</span>
                <select
                  value={delayTime}
                  onChange={(e) =>
                    onChangeFx({ delayTime: e.target.value as DelaySubdivision })
                  }
                >
                  {DELAY_TIME_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="field"
                title="Feedback. Över 80% går mot self-oscillation — håll kvar runt 30–60% för synthwave."
              >
                <span>FB {Math.round(delayFb * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.02}
                  value={delayFb}
                  onChange={(e) => onChangeFx({ delayFeedback: Number(e.target.value) })}
                />
              </label>
              <label
                className="field"
                title={DELAY_MODE_OPTIONS.find((m) => m.id === delayMode)?.hint ?? ''}
              >
                <span>Mode</span>
                <select
                  value={delayMode}
                  onChange={(e) =>
                    onChangeFx({ delayMode: e.target.value as DelayMode })
                  }
                >
                  {DELAY_MODE_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id} title={m.hint}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* === Reverb-grupp === */}
            <div className="field-row field-row--fx">
              <span className="group__label">Reverb</span>
              <label className="field" title="Send till kort reverb (~1.2 s). Bra för leads och plate-känsla.">
                <span>Short {Math.round(reverbShort * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={reverbShort}
                  onChange={(e) => onChangeFx({ reverbShort: Number(e.target.value) })}
                />
              </label>
              <label className="field" title="Send till lång reverb (~6.5 s). Synthwave-pad-svans, FM-84-territory.">
                <span>Long {Math.round(reverbLong * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={reverbLong}
                  onChange={(e) => onChangeFx({ reverbLong: Number(e.target.value) })}
                />
              </label>
              <label
                className="field"
                title="Pre-delay: kort tystnad mellan transient och reverb-svans. 0 = svansen börjar direkt (mosigt), 30–80 ms = transient hörs ren först (pro-känsla). Gäller båda Short och Long."
              >
                <span>Pre {Math.round(reverbPreDelay * 1000)} ms</span>
                <input
                  type="range"
                  min={0}
                  max={0.15}
                  step={0.005}
                  value={reverbPreDelay}
                  onChange={(e) =>
                    onChangeFx({ reverbPreDelay: Number(e.target.value) })
                  }
                  disabled={reverbShort === 0 && reverbLong === 0}
                />
              </label>
            </div>

            {/* === Karaktär-grupp: saturation + chorus + bitcrusher === */}
            <div className="field-row field-row--fx">
              <span className="group__label">Karaktär</span>
              <label className="field" title="Tape/drive-liknande mättnad. Ger analog varm energi; lyft på hats & bass.">
                <span>Saturation {Math.round(fx.saturation * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={fx.saturation}
                  onChange={(e) => onChangeFx({ saturation: Number(e.target.value) })}
                />
              </label>
              <label
                className="field"
                title="Stereo-chorus wet-mängd. Tjockar leads och pad i bredden. Rate och depth styr karaktären."
              >
                <span>Chorus {Math.round(chorus * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={chorus}
                  onChange={(e) => onChangeFx({ chorus: Number(e.target.value) })}
                />
              </label>
              <label
                className="field"
                title="Chorus rate (LFO-frekvens). Långsamt = drömskt svaj (0.3 Hz), snabbt = vibrato-känsla (4 Hz). Default 1.5 Hz."
              >
                <span>· rate {chorusRate.toFixed(1)} Hz</span>
                <input
                  type="range"
                  min={0.1}
                  max={6}
                  step={0.1}
                  value={chorusRate}
                  onChange={(e) =>
                    onChangeFx({ chorusRate: Number(e.target.value) })
                  }
                  disabled={chorus === 0}
                />
              </label>
              <label
                className="field"
                title="Chorus depth (modulationsmängd). Lite (0.2) = subtilt, mycket (1.0) = rejäl swirl. Default 0.7."
              >
                <span>· depth {Math.round(chorusDepth * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={chorusDepth}
                  onChange={(e) =>
                    onChangeFx({ chorusDepth: Number(e.target.value) })
                  }
                  disabled={chorus === 0}
                />
              </label>
              <label
                className="field"
                title="Bitcrusher: 8-bit ner mot 2-bit. Glitch/lo-fi-färg på hats och perc."
              >
                <span>Crush {Math.round(crusher * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={crusher}
                  onChange={(e) => onChangeFx({ bitcrusher: Number(e.target.value) })}
                />
              </label>
              <button
                className="chip chip--reset"
                onClick={() =>
                  onChangeFx({
                    delay: 0,
                    delayMix: 0,
                    reverb: 0,
                    reverbShort: 0,
                    reverbLong: 0,
                    saturation: 0,
                    chorus: 0,
                    bitcrusher: 0,
                  })
                }
                disabled={allDry}
                title="Nollställ alla effekter för detta spår"
              >
                ↺ Torrt
              </button>
            </div>
          </>
        );
      })()}

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

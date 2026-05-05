import { degreeToMidi, midiToName, scaleLength } from '../engine/scales';
import type { Pattern, PitchNote, PitchStep, Track } from '../engine/types';
import { PitchInput } from './PitchInput';

type Props = {
  pattern: Pattern;
  track: Track;
  currentStep: number;
  onChangeTrack: (updater: (t: Track) => Track) => void;
};

export function PitchTrack({ pattern, track, currentStep, onChangeTrack }: Props) {
  const len = scaleLength(pattern.scale);

  const updateStep = (i: number, patch: Partial<PitchStep>) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      next[i] = { ...next[i], ...patch };
      return { ...t, pitchSteps: next };
    });
  };

  const addExtraNote = (i: number) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      const cur = next[i];
      const extras = cur.extraNotes ?? [];
      const lastDeg = extras.length > 0 ? extras[extras.length - 1].scaleDegree : cur.scaleDegree;
      const lastOct = extras.length > 0 ? extras[extras.length - 1].octaveOffset : cur.octaveOffset;
      let nextDeg = lastDeg + 2;
      let nextOct = lastOct;
      if (nextDeg >= len) {
        nextDeg = nextDeg - len;
        nextOct = Math.min(2, nextOct + 1);
      }
      next[i] = { ...cur, extraNotes: [...extras, { scaleDegree: nextDeg, octaveOffset: nextOct }] };
      return { ...t, pitchSteps: next };
    });
  };

  const updateExtraNote = (i: number, noteIdx: number, patch: Partial<PitchNote>) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      const cur = next[i];
      const extras = (cur.extraNotes ?? []).slice();
      extras[noteIdx] = { ...extras[noteIdx], ...patch };
      next[i] = { ...cur, extraNotes: extras };
      return { ...t, pitchSteps: next };
    });
  };

  const removeExtraNote = (i: number, noteIdx: number) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      const cur = next[i];
      const extras = (cur.extraNotes ?? []).filter((_, k) => k !== noteIdx);
      next[i] = { ...cur, extraNotes: extras.length > 0 ? extras : undefined };
      return { ...t, pitchSteps: next };
    });
  };

  return (
    <div className="track track--pitch">
      <div className="track__header">
        <h2 style={{ color: track.color }}>Pitch · {track.name}</h2>
        <span className="muted">{track.pitchSteps.length} steg</span>
      </div>
      <div className="steps">
        {track.pitchSteps.map((s, i) => {
          const playing = i === currentStep;
          const extras = s.extraNotes ?? [];
          const isDrum = track.voice === 'hats';
          return (
            <div
              key={i}
              className={`step step--pitch ${playing ? 'is-playing' : ''} ${extras.length > 0 ? 'has-chord' : ''}`}
            >
              <PitchInput
                className="step__noteName"
                value={{
                  scaleDegree: s.scaleDegree,
                  octaveOffset: s.octaveOffset,
                  semitoneOffset: s.semitoneOffset,
                }}
                rootNote={pattern.rootNote}
                baseOctave={pattern.baseOctave + track.octaveShift}
                scale={pattern.scale}
                onChange={(v) =>
                  updateStep(i, {
                    scaleDegree: v.scaleDegree,
                    octaveOffset: v.octaveOffset,
                    semitoneOffset: v.semitoneOffset,
                  })
                }
              />
              <select
                className="step__degree"
                value={s.scaleDegree}
                onChange={(e) =>
                  updateStep(i, {
                    scaleDegree: Number(e.target.value),
                    semitoneOffset: undefined,
                  })
                }
                title="Skalsteg"
              >
                {Array.from({ length: len }, (_, d) => (
                  <option key={d} value={d}>
                    {d + 1}
                  </option>
                ))}
              </select>
              <div className="step__octave">
                <button
                  className="tiny"
                  onClick={() =>
                    updateStep(i, { octaveOffset: Math.max(-2, s.octaveOffset - 1) })
                  }
                  title="Oktav ner"
                >
                  −
                </button>
                <span>{s.octaveOffset > 0 ? `+${s.octaveOffset}` : s.octaveOffset}</span>
                <button
                  className="tiny"
                  onClick={() =>
                    updateStep(i, { octaveOffset: Math.min(2, s.octaveOffset + 1) })
                  }
                  title="Oktav upp"
                >
                  +
                </button>
              </div>
              <label className="step__slide">
                <input
                  type="checkbox"
                  checked={s.slide}
                  onChange={(e) => updateStep(i, { slide: e.target.checked })}
                />
                <span>glide</span>
              </label>
              {!isDrum && (
                <div className="step__chord">
                  {extras.map((n, k) => {
                    const extraMidi = degreeToMidi(
                      pattern.rootNote,
                      pattern.baseOctave + track.octaveShift,
                      pattern.scale,
                      n.scaleDegree,
                      n.octaveOffset,
                      n.semitoneOffset ?? 0,
                    );
                    return (
                      <div key={k} className="step__chord-note" title={midiToName(extraMidi)}>
                        <PitchInput
                          value={{
                            scaleDegree: n.scaleDegree,
                            octaveOffset: n.octaveOffset,
                            semitoneOffset: n.semitoneOffset,
                          }}
                          rootNote={pattern.rootNote}
                          baseOctave={pattern.baseOctave + track.octaveShift}
                          scale={pattern.scale}
                          onChange={(v) =>
                            updateExtraNote(i, k, {
                              scaleDegree: v.scaleDegree,
                              octaveOffset: v.octaveOffset,
                              semitoneOffset: v.semitoneOffset,
                            })
                          }
                        />
                        <button
                          className="tiny"
                          onClick={() => removeExtraNote(i, k)}
                          title="Ta bort ton"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="tiny step__chord-add"
                    onClick={() => addExtraNote(i)}
                    title="Stapla ton (lägger tersen/kvinten ovanpå)"
                    disabled={extras.length >= 5}
                  >
                    + ton
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

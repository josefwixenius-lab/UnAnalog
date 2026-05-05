import { useState } from 'react';
import { degreeToMidi, midiToName, scaleLength } from '../engine/scales';
// degreeToMidi används bara för chord-extra-tonernas tooltip i CompositeSteps;
// huvudtonens namn renderas av PitchInput-komponenten.
import type {
  GateStep,
  Pattern,
  PitchNote,
  PitchStep,
  Track,
  TrigCondition,
} from '../engine/types';
import { PitchTrack } from './PitchTrack';
import { GateTrack } from './GateTrack';
import { PitchInput } from './PitchInput';

type Props = {
  pattern: Pattern;
  track: Track;
  pitchCurrent: number;
  gateCurrent: number;
  detailMode: 'compact' | 'detailed';
  onChangeTrack: (updater: (t: Track) => Track) => void;
};

/**
 * Beskrivande tooltips som återanvänds. Webbläsaren visar `title`-attributet
 * vid hover – användaren kan slippa gissa vad reglagen gör.
 */
const TT = {
  note: 'Tonen som spelas. Härleds automatiskt från skalsteg + tonart + skala + oktav.',
  degree:
    'Skalsteg (1 = grundton, 2 = andra tonen i skalan osv.). Byter du skala ändras klingande tonen men skalsteget behålls.',
  octave: 'Oktav-offset för just detta steg (−2 till +2). Bra för att hoppa upp enstaka toner.',
  glide:
    'Glide/slide. Skickas som portamento till MIDI-instrumentet – vissa synthar hakar ihop tonerna.',
  addChord:
    'Stapla en extra ton ovanpå detta steg (polyfoni). Används för ackord. Upp till 5 extratoner per steg.',
  removeChord: 'Ta bort denna extra ton.',
  trigger:
    'På/av. När steget är på spelas tonen när sequencern når hit. Klicka för att toggla.',
  condition:
    'Villkor som styr NÄR steget spelas: alltid, med sannolikhet, var N:e cykel, efter/före annan träff, eller under FILL-läge.',
  gate: 'Gate-längd — hur länge tonen hålls inom steget. 5 % = stackato, 100 % = legato.',
  probability:
    'Sannolikhet att steget faktiskt spelar varje gång. 100 % = alltid, 50 % = hälften, 0 % = aldrig. MIDI-export räknar 50 %+ som på.',
  velocity:
    'Velocity (anslagsstyrka) – hur hårt tonen spelas. Styr internt volymen och skickas som MIDI-velocity.',
  nudge:
    'Mikrotiming. Flyttar steget tidigare (−) eller senare (+) med upp till 50 % av ett 16-delssteg. Dubbelklicka för att nollställa.',
  ratchet:
    'Ratchet – splittrar steget i 2–4 snabba retriggers. Bra för snareflöden eller fills.',
  accent: 'Accent — lyfter velocity +0.2 (upp till max). För att markera 1:or/3:or etc.',
  plock:
    'Filter-lock (p-lock). Låser filter-cutoff till ett specifikt värde just för detta steg (som på Elektron).',
  expand:
    'Fäll ut/in detalj-kontroller för just detta steg (gate-längd, probability, velocity, nudge, ratchet, p-lock och extra-toner).',
};

export function StepEditor({
  pattern,
  track,
  pitchCurrent,
  gateCurrent,
  detailMode,
  onChangeTrack,
}: Props) {
  const isPolymeter = track.pitchSteps.length !== track.gateSteps.length;

  if (isPolymeter) {
    return (
      <>
        <div className="polymeter-notice">
          ⚠ <strong>Polymeter aktiv</strong> — pitch har {track.pitchSteps.length} steg, gate har{' '}
          {track.gateSteps.length}. Raderna cyklar oberoende så samma kolumn-position spelas inte
          samtidigt. Därför visas pitch och gate separat.
        </div>
        <PitchTrack
          pattern={pattern}
          track={track}
          currentStep={pitchCurrent}
          onChangeTrack={onChangeTrack}
        />
        <GateTrack track={track} currentStep={gateCurrent} onChangeTrack={onChangeTrack} />
      </>
    );
  }

  return (
    <CompositeSteps
      pattern={pattern}
      track={track}
      pitchCurrent={pitchCurrent}
      gateCurrent={gateCurrent}
      detailMode={detailMode}
      onChangeTrack={onChangeTrack}
    />
  );
}

function CompositeSteps({
  pattern,
  track,
  pitchCurrent,
  gateCurrent,
  detailMode,
  onChangeTrack,
}: Props) {
  const len = scaleLength(pattern.scale);
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<number>>(() => new Set());
  const allExpanded = detailMode === 'detailed';

  const toggleExpand = (i: number) => {
    setManuallyExpanded((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const updatePitch = (i: number, patch: Partial<PitchStep>) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      next[i] = { ...next[i], ...patch };
      return { ...t, pitchSteps: next };
    });
  };

  const updateGate = (i: number, patch: Partial<GateStep>) => {
    onChangeTrack((t) => {
      const next = t.gateSteps.slice();
      next[i] = { ...next[i], ...patch };
      return { ...t, gateSteps: next };
    });
  };

  const addExtraNote = (i: number) => {
    onChangeTrack((t) => {
      const next = t.pitchSteps.slice();
      const cur = next[i];
      const extras = cur.extraNotes ?? [];
      const lastDeg = extras.length > 0 ? extras[extras.length - 1].scaleDegree : cur.scaleDegree;
      const lastOct =
        extras.length > 0 ? extras[extras.length - 1].octaveOffset : cur.octaveOffset;
      let nextDeg = lastDeg + 2;
      let nextOct = lastOct;
      if (nextDeg >= len) {
        nextDeg = nextDeg - len;
        nextOct = Math.min(2, nextOct + 1);
      }
      next[i] = {
        ...cur,
        extraNotes: [...extras, { scaleDegree: nextDeg, octaveOffset: nextOct }],
      };
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

  const isDrum = track.voice === 'hats';

  return (
    <div className="step-editor step-editor--composite">
      <div className="step-editor__header">
        <h2 style={{ color: track.color }}>
          Steg · {track.name}
        </h2>
        <span className="muted">
          {track.pitchSteps.length} steg · pitch + gate i samma kort
        </span>
      </div>
      <div className="composite-steps">
        {track.pitchSteps.map((p, i) => {
          const g = track.gateSteps[i];
          if (!g) return null;
          const isExpanded = allExpanded || manuallyExpanded.has(i);
          const pitchPlaying = i === pitchCurrent;
          const gatePlaying = i === gateCurrent;
          const playing = pitchPlaying || gatePlaying;
          const extras = p.extraNotes ?? [];
          const isNudged = (g.nudge ?? 0) !== 0;
          const nudgePct = Math.round((g.nudge ?? 0) * 100);
          const probPct = Math.round(g.probability * 100);
          const velPct = Math.round(g.velocity * 100);
          const isProbLow = g.probability < 1;
          const hasCondition = g.condition !== 'always';

          const classes = [
            'composite-step',
            g.active ? 'is-gate-active' : '',
            playing ? 'is-playing' : '',
            hasCondition ? 'has-condition' : '',
            g.filterLock != null ? 'has-plock' : '',
            isProbLow ? 'is-prob-low' : '',
            isNudged ? 'is-nudged' : '',
            extras.length > 0 ? 'has-chord' : '',
            isExpanded ? 'is-expanded' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={i}
              className={classes}
              style={
                isNudged
                  ? { transform: `translateX(${(g.nudge ?? 0) * 10}px)` }
                  : undefined
              }
            >
              {/* === Pitch-header === */}
              <PitchInput
                className="composite-step__note"
                value={{
                  scaleDegree: p.scaleDegree,
                  octaveOffset: p.octaveOffset,
                  semitoneOffset: p.semitoneOffset,
                }}
                rootNote={pattern.rootNote}
                baseOctave={pattern.baseOctave + track.octaveShift}
                scale={pattern.scale}
                title={TT.note}
                onChange={(v) =>
                  updatePitch(i, {
                    scaleDegree: v.scaleDegree,
                    octaveOffset: v.octaveOffset,
                    semitoneOffset: v.semitoneOffset,
                  })
                }
              />
              <select
                className="composite-step__degree"
                value={p.scaleDegree}
                onChange={(e) =>
                  updatePitch(i, {
                    scaleDegree: Number(e.target.value),
                    semitoneOffset: undefined,
                  })
                }
                title={TT.degree}
              >
                {Array.from({ length: len }, (_, d) => (
                  <option key={d} value={d}>
                    {d + 1}
                  </option>
                ))}
              </select>
              <div className="composite-step__octave" title={TT.octave}>
                <button
                  className="tiny"
                  onClick={() =>
                    updatePitch(i, { octaveOffset: Math.max(-2, p.octaveOffset - 1) })
                  }
                  title="Oktav ner"
                >
                  −
                </button>
                <span>{p.octaveOffset > 0 ? `+${p.octaveOffset}` : p.octaveOffset}</span>
                <button
                  className="tiny"
                  onClick={() =>
                    updatePitch(i, { octaveOffset: Math.min(2, p.octaveOffset + 1) })
                  }
                  title="Oktav upp"
                >
                  +
                </button>
              </div>

              {/* === Gate-rad (alltid synlig) === */}
              <div className="composite-step__gate">
                <button
                  className={`composite-step__trigger ${g.active ? 'is-on' : ''}`}
                  onClick={() => updateGate(i, { active: !g.active })}
                  title={TT.trigger}
                >
                  {g.active ? '●' : '○'}
                </button>
                <label className="composite-step__accent" title={TT.accent}>
                  <input
                    type="checkbox"
                    checked={g.accent}
                    onChange={(e) => updateGate(i, { accent: e.target.checked })}
                  />
                  <span>acc</span>
                </label>
                <button
                  className={`composite-step__expand ${isExpanded ? 'is-on' : ''}`}
                  onClick={() => toggleExpand(i)}
                  title={TT.expand}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? '▴' : '▾'}
                </button>
              </div>
              <select
                className="composite-step__condition"
                value={g.condition}
                onChange={(e) =>
                  updateGate(i, { condition: e.target.value as TrigCondition })
                }
                title={TT.condition}
              >
                <option value="always">alltid</option>
                <optgroup label="sannolikhet">
                  <option value="p25">25 %</option>
                  <option value="p50">50 %</option>
                  <option value="p75">75 %</option>
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

              {/* Status-prickar för dolda värden */}
              <div className="composite-step__dots" aria-hidden>
                {extras.length > 0 && (
                  <span className="dot dot--chord" title={`${extras.length} extra-ton(er)`}>
                    ●
                  </span>
                )}
                {isProbLow && (
                  <span className="dot dot--prob" title={`Probability ${probPct} %`}>
                    ●
                  </span>
                )}
                {isNudged && (
                  <span
                    className="dot dot--nudge"
                    title={`Nudge ${nudgePct > 0 ? '+' : ''}${nudgePct} %`}
                  >
                    ●
                  </span>
                )}
                {g.filterLock != null && (
                  <span
                    className="dot dot--plock"
                    title={`Filter-lock ${Math.round((g.filterLock ?? 0) * 100)} %`}
                  >
                    ●
                  </span>
                )}
                {g.ratchet > 1 && (
                  <span className="dot dot--ratchet" title={`Ratchet ${g.ratchet}×`}>
                    {g.ratchet}
                  </span>
                )}
              </div>

              {/* === Detalj-sektion (fällbar) === */}
              {isExpanded && (
                <div className="composite-step__details">
                  <label className="composite-step__slide" title={TT.glide}>
                    <input
                      type="checkbox"
                      checked={p.slide}
                      onChange={(e) => updatePitch(i, { slide: e.target.checked })}
                    />
                    <span>glide</span>
                  </label>

                  {p.slide && (
                    <label
                      className="composite-step__mini"
                      title="Slide-tid: 0 = snapp, 1 = full step-längd. Styr hur långt portamento (legato) blir mot nästa step."
                    >
                      <span>tid</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={p.slideTime ?? 0.5}
                        onChange={(e) =>
                          updatePitch(i, { slideTime: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}

                  <label className="composite-step__mini" title={TT.gate}>
                    <span>gate</span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={g.gate}
                      onChange={(e) => updateGate(i, { gate: Number(e.target.value) })}
                    />
                  </label>

                  <label
                    className="composite-step__mini is-prob"
                    title={`${TT.probability}\nNu: ${probPct} %`}
                  >
                    <span>🎲 {probPct} %</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={g.probability}
                      onChange={(e) => updateGate(i, { probability: Number(e.target.value) })}
                    />
                  </label>

                  <label
                    className="composite-step__mini is-vel"
                    title={`${TT.velocity}\nNu: ${velPct} %`}
                  >
                    <span>vel {velPct} %</span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={g.velocity}
                      onChange={(e) => updateGate(i, { velocity: Number(e.target.value) })}
                    />
                  </label>

                  <label
                    className="composite-step__mini is-nudge"
                    title={`${TT.nudge}\nNu: ${nudgePct > 0 ? '+' : ''}${nudgePct} %`}
                  >
                    <span>
                      {isNudged ? (nudgePct > 0 ? `+${nudgePct}` : `${nudgePct}`) : '±0'} %
                    </span>
                    <input
                      type="range"
                      min={-0.5}
                      max={0.5}
                      step={0.02}
                      value={g.nudge ?? 0}
                      onChange={(e) => updateGate(i, { nudge: Number(e.target.value) })}
                      onDoubleClick={() => updateGate(i, { nudge: 0 })}
                    />
                  </label>

                  <div className="composite-step__ratchet" title={TT.ratchet}>
                    {[1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        className={`tiny ${g.ratchet === r ? 'is-on' : ''}`}
                        onClick={() => updateGate(i, { ratchet: r })}
                        title={`Ratchet ${r}× — steget delas i ${r} snabba retriggers.`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`composite-step__plock ${g.filterLock != null ? 'is-on' : ''}`}
                    title={TT.plock}
                  >
                    <button
                      className="tiny"
                      onClick={() =>
                        updateGate(i, { filterLock: g.filterLock == null ? 0.5 : null })
                      }
                      title={
                        g.filterLock == null
                          ? 'Lås filter-cutoff för detta steg'
                          : 'Ta bort filterlås'
                      }
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
                        onChange={(e) =>
                          updateGate(i, { filterLock: Number(e.target.value) })
                        }
                        title={`Filter-cutoff låst: ${Math.round((g.filterLock ?? 0) * 100)} %`}
                      />
                    )}
                  </div>

                  {!isDrum && (
                    <div className="composite-step__chord">
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
                          <div
                            key={k}
                            className="composite-step__chord-note"
                            title={`Extra-ton: ${midiToName(extraMidi)}`}
                          >
                            <PitchInput
                              className="composite-step__chord-pitch"
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
                              title={TT.removeChord}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      <button
                        className="tiny composite-step__chord-add"
                        onClick={() => addExtraNote(i)}
                        title={TT.addChord}
                        disabled={extras.length >= 5}
                      >
                        + ton
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

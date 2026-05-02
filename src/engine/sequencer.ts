import * as Tone from 'tone';
import type { Pattern, PlayDirection, TrigCondition, VoiceKind } from './types';
import { degreeToMidi } from './scales';
import { createVoice, type Voice } from './voices';
import { TrackFxChain } from './audioBus';

export type NoteEvent = {
  trackId: string;
  timeSec: number;
  midi: number;
  durationSec: number;
  velocity: number;
  midiChannel: number;
  /** Per-spår MIDI-port override. Tom = använd global port. */
  midiOutId?: string;
  slide: boolean;
};

export type ClockMessage = 'clock' | 'start' | 'stop' | 'continue';

export type SequencerCallbacks = {
  onNote?: (event: NoteEvent) => void;
  onStep?: (trackId: string, pitchIdx: number, gateIdx: number) => void;
  onBar?: () => void;
  onClock?: (msg: ClockMessage, whenAudioSec: number) => void;
};

type TrackRuntime = {
  pitchIdx: number;
  gateIdx: number;
  /**
   * Ping-pong-riktning per rad. +1 = framåt, -1 = bakåt. Två rader pga
   * polymeter — pitch och gate kan ha olika längd och därför vända vid
   * olika tidpunkter. Ignoreras för andra direction-lägen.
   */
  pitchDir: 1 | -1;
  gateDir: 1 | -1;
  cycleCount: number;
  /** Räknar steg sen senaste cykel-vändning. cycleCount++ när detta når len. */
  cycleTick: number;
  prevFired: boolean;
};

/**
 * Beräkna nästa step-index givet aktuellt index, längd och riktning.
 * För ping-pong muteras `dirRef` (i runtime:n) så vändningen kommer ihåg.
 *
 * Edge cases:
 * - `len <= 1`: returnerar alltid 0
 * - `pingpong` med len = 2: bouncar mellan 0 och 1 varje step (perfekt)
 * - `brownian` lägger till -1, 0 eller +1 (slumpvis) och wrappar
 */
function advance(
  cur: number,
  len: number,
  dir: PlayDirection,
  runtime: TrackRuntime,
  isGate: boolean,
): number {
  if (len <= 1) return 0;
  switch (dir) {
    case 'forward':
      return (cur + 1) % len;
    case 'reverse':
      return (cur - 1 + len) % len;
    case 'pingpong': {
      const cur2 = isGate ? runtime.gateDir : runtime.pitchDir;
      let next = cur + cur2;
      let nextDir: 1 | -1 = cur2;
      if (next >= len) {
        nextDir = -1;
        next = Math.max(0, len - 2);
      } else if (next < 0) {
        nextDir = 1;
        next = Math.min(len - 1, 1);
      }
      if (isGate) runtime.gateDir = nextDir;
      else runtime.pitchDir = nextDir;
      return next;
    }
    case 'random':
      return Math.floor(Math.random() * len);
    case 'brownian': {
      const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
      return ((cur + delta) % len + len) % len;
    }
  }
}

type VoiceEntry = {
  kind: VoiceKind;
  voice: Voice;
  fxChain: TrackFxChain;
};

function evalCondition(c: TrigCondition, rt: TrackRuntime, fill: boolean): boolean {
  switch (c) {
    case 'always': return true;
    case 'p25': return Math.random() < 0.25;
    case 'p50': return Math.random() < 0.5;
    case 'p75': return Math.random() < 0.75;
    case '1:2': return rt.cycleCount % 2 === 0;
    case '2:2': return rt.cycleCount % 2 === 1;
    case '1:3': return rt.cycleCount % 3 === 0;
    case '2:3': return rt.cycleCount % 3 === 1;
    case '3:3': return rt.cycleCount % 3 === 2;
    case '1:4': return rt.cycleCount % 4 === 0;
    case '2:4': return rt.cycleCount % 4 === 1;
    case '3:4': return rt.cycleCount % 4 === 2;
    case '4:4': return rt.cycleCount % 4 === 3;
    case 'notPrev': return !rt.prevFired;
    case 'prev': return rt.prevFired;
    case 'fill': return fill;
    case 'notFill': return !fill;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeVelocity(baseVelocity: number, accent: boolean, jitter: number): number {
  let v = baseVelocity;
  if (accent) v = Math.min(1, v + 0.2);
  if (jitter > 0) {
    const r = (Math.random() * 2 - 1) * jitter;
    v = v * (1 + r);
  }
  return clamp(v, 0.05, 1);
}

export class Sequencer {
  private pattern: Pattern;
  private scheduleId: number | null = null;
  private clockScheduleId: number | null = null;
  private cb: SequencerCallbacks;
  private audible = true;
  private runtimes = new Map<string, TrackRuntime>();
  private voices = new Map<string, VoiceEntry>();
  private tickCount = 0;
  private clockEnabled = false;
  private externalTempo: number | null = null;

  constructor(initial: Pattern, cb: SequencerCallbacks = {}) {
    this.pattern = initial;
    this.cb = cb;
    this.syncRuntimes(initial);
  }

  private syncRuntimes(p: Pattern) {
    const next = new Map<string, TrackRuntime>();
    for (const t of p.tracks) {
      const dir = t.playDirection ?? 'forward';
      // Vid reverse: starta sista stepet så första tick ger len-1 istället
      // för att hoppa över hela första cyklen. Vi spelar AKTUELLT step varje
      // tick (inte nästa), så pitchIdx/gateIdx här är vad som hörs på tick 1.
      const startPitch = dir === 'reverse' ? Math.max(0, t.pitchSteps.length - 1) : 0;
      const startGate = dir === 'reverse' ? Math.max(0, t.gateSteps.length - 1) : 0;
      next.set(
        t.id,
        this.runtimes.get(t.id) ?? {
          pitchIdx: startPitch,
          gateIdx: startGate,
          pitchDir: 1,
          gateDir: 1,
          cycleCount: 0,
          cycleTick: 0,
          prevFired: false,
        },
      );
    }
    this.runtimes = next;
  }

  private syncVoices(p: Pattern) {
    if (!this.audible) return;
    const seen = new Set<string>();
    for (const t of p.tracks) {
      seen.add(t.id);
      const existing = this.voices.get(t.id);
      const fx = t.fx ?? { delay: 0, reverb: 0, saturation: 0 };
      const pan = t.pan ?? 0;
      if (!existing || existing.kind !== t.voice) {
        existing?.voice.dispose();
        existing?.fxChain.dispose();
        const voice = createVoice(t.voice);
        voice.setVolume(t.volumeDb);
        voice.setFilterBase(t.filterCutoff, t.filterResonance);
        voice.setLfo(t.lfo);
        const fxChain = new TrackFxChain(fx);
        fxChain.setPan(pan);
        voice.connectOutput(fxChain.getInput());
        this.voices.set(t.id, { kind: t.voice, voice, fxChain });
      } else {
        existing.voice.setVolume(t.volumeDb);
        existing.voice.setFilterBase(t.filterCutoff, t.filterResonance);
        existing.voice.setLfo(t.lfo);
        existing.fxChain.setFx(fx);
        existing.fxChain.setPan(pan);
      }
    }
    for (const [id, v] of this.voices) {
      if (!seen.has(id)) {
        v.voice.dispose();
        v.fxChain.dispose();
        this.voices.delete(id);
      }
    }
  }

  private disposeAllVoices() {
    for (const v of this.voices.values()) {
      v.voice.dispose();
      v.fxChain.dispose();
    }
    this.voices.clear();
  }

  setPattern(p: Pattern) {
    this.pattern = p;
    this.syncRuntimes(p);
    this.syncVoices(p);
    const tt = Tone.getTransport();
    tt.bpm.value = this.externalTempo ?? p.tempo;
    tt.swing = p.swing;
    tt.swingSubdivision = '16n';
  }

  /**
   * Sätter extern tempo-override. Så länge den är satt ignoreras pattern.tempo
   * och Tone.Transport drivs av det uppmätta externa tempot.
   */
  setExternalTempo(bpm: number | null) {
    this.externalTempo = bpm;
    if (bpm !== null) {
      Tone.getTransport().bpm.value = bpm;
    } else {
      // Tillbaka till intern — återställ från patterns lagrade tempo
      Tone.getTransport().bpm.value = this.pattern.tempo;
    }
  }

  setCallbacks(cb: SequencerCallbacks) {
    this.cb = cb;
  }

  setClockEnabled(enabled: boolean) {
    this.clockEnabled = enabled;
    if (!enabled && this.clockScheduleId !== null) {
      Tone.getTransport().clear(this.clockScheduleId);
      this.clockScheduleId = null;
    } else if (enabled && this.scheduleId !== null && this.clockScheduleId === null) {
      this.clockScheduleId = Tone.getTransport().scheduleRepeat(
        (time) => this.cb.onClock?.('clock', time),
        '96n',
      );
    }
  }

  async start() {
    await Tone.start();
    this.syncVoices(this.pattern);
    const tt = Tone.getTransport();
    tt.bpm.value = this.externalTempo ?? this.pattern.tempo;
    tt.swing = this.pattern.swing;
    tt.swingSubdivision = '16n';
    this.resetRuntimes();
    this.tickCount = 0;
    if (this.scheduleId === null) {
      this.scheduleId = tt.scheduleRepeat((time) => this.tick(time), '16n');
    }
    if (this.clockEnabled && this.clockScheduleId === null) {
      this.clockScheduleId = tt.scheduleRepeat(
        (time) => this.cb.onClock?.('clock', time),
        '96n',
      );
    }
    if (this.clockEnabled) {
      this.cb.onClock?.('start', Tone.now());
    }
    tt.start();
  }

  stop() {
    const tt = Tone.getTransport();
    tt.stop();
    if (this.scheduleId !== null) {
      tt.clear(this.scheduleId);
      this.scheduleId = null;
    }
    if (this.clockScheduleId !== null) {
      tt.clear(this.clockScheduleId);
      this.clockScheduleId = null;
    }
    if (this.clockEnabled) {
      this.cb.onClock?.('stop', Tone.now());
    }
    this.resetRuntimes();
    this.tickCount = 0;
    for (const t of this.pattern.tracks) {
      this.cb.onStep?.(t.id, -1, -1);
    }
  }

  setAudible(audible: boolean) {
    this.audible = audible;
    if (audible) {
      this.syncVoices(this.pattern);
    } else {
      this.disposeAllVoices();
    }
  }

  private resetRuntimes() {
    for (const t of this.pattern.tracks) {
      const rt = this.runtimes.get(t.id);
      if (!rt) continue;
      const dir = t.playDirection ?? 'forward';
      rt.pitchIdx = dir === 'reverse' ? Math.max(0, t.pitchSteps.length - 1) : 0;
      rt.gateIdx = dir === 'reverse' ? Math.max(0, t.gateSteps.length - 1) : 0;
      rt.pitchDir = 1;
      rt.gateDir = 1;
      rt.cycleCount = 0;
      rt.cycleTick = 0;
      rt.prevFired = false;
    }
  }

  private tick(time: number) {
    if (this.tickCount % 16 === 0) {
      this.cb.onBar?.();
    }
    this.tickCount++;
    const p = this.pattern;
    const stepSec = Tone.Time('16n').toSeconds();
    const anySolo = p.tracks.some((t) => t.solo);

    for (const t of p.tracks) {
      const rt = this.runtimes.get(t.id);
      if (!rt) continue;
      const gate = t.gateSteps[rt.gateIdx];
      const pitch = t.pitchSteps[rt.pitchIdx];
      const trackAudible = t.enabled && (!anySolo || t.solo);
      let fired = false;

      if (gate && pitch && gate.active && trackAudible) {
        const condPass = evalCondition(gate.condition, rt, p.fillActive);
        const probPass = Math.random() <= gate.probability;
        if (condPass && probPass) {
          fired = true;
          const allNotes = [
            { scaleDegree: pitch.scaleDegree, octaveOffset: pitch.octaveOffset },
            ...(pitch.extraNotes ?? []),
          ];
          const midis = allNotes.map((n) =>
            degreeToMidi(
              p.rootNote,
              p.baseOctave + t.octaveShift,
              p.scale,
              n.scaleDegree,
              n.octaveOffset,
            ),
          );
          const ratchet = Math.max(1, Math.min(4, gate.ratchet));
          const subStep = stepSec / ratchet;
          // Slide förlänger noten: dur ökar mot nästa step så MIDI får
          // overlap (legato → trigga portamento på extern synth) och
          // internal-voice sustainer ut hela glide-tiden.
          // slideTime: 0 = snapp, 1 = full step. Default 0.5 om saknat.
          const slideAmt = pitch.slide ? clamp(pitch.slideTime ?? 0.5, 0, 1) : 0;
          const slideExtra = slideAmt * stepSec * 0.85;
          const dur = Math.max(0.01, subStep * gate.gate + slideExtra);
          const baseVel = typeof gate.velocity === 'number' ? gate.velocity : 0.8;
          const jitter = typeof t.velocityJitter === 'number' ? t.velocityJitter : 0;
          const nudgeFrac = clamp(typeof gate.nudge === 'number' ? gate.nudge : 0, -0.5, 0.5);
          const nudgeSec = nudgeFrac * stepSec;
          const voice = this.voices.get(t.id);
          const isNoise = t.voice === 'hats';
          for (let r = 0; r < ratchet; r++) {
            // Tone har lookahead (~100 ms) så negativ nudge funkar upp till ±50% av steget
            // vid rimliga tempon. Vid mycket höga BPM kan negativ nudge klippas av Tone.
            const t0 = time + nudgeSec + r * subStep;
            const midisToPlay = isNoise ? [midis[0]] : midis;
            const velocity = computeVelocity(baseVel, gate.accent, jitter);
            for (const midi of midisToPlay) {
              voice?.voice.trigger(midi, dur, t0, velocity, { filterLock: gate.filterLock });
              this.cb.onNote?.({
                trackId: t.id,
                timeSec: t0,
                midi,
                durationSec: dur,
                velocity,
                midiChannel: t.midiChannel,
                midiOutId: t.midiOutId,
                slide: pitch.slide,
              });
            }
          }
        }
      }

      rt.prevFired = fired;
      const trackId = t.id;
      const pIdx = rt.pitchIdx;
      const gIdx = rt.gateIdx;
      Tone.getDraw().schedule(() => {
        this.cb.onStep?.(trackId, pIdx, gIdx);
      }, time);

      const dir = t.playDirection ?? 'forward';
      const pLen = Math.max(1, t.pitchSteps.length);
      const gLen = Math.max(1, t.gateSteps.length);
      // Cycle-räknaren tickar varje step. När den når gate-radens längd
      // räknas det som "ny cykel" — det är vad 1:N-conditions baseras på.
      // Detta är konsistent oavsett direction (forward/reverse/random/…)
      // medan tidigare endast wrap-to-0 räknades, vilket bröt för reverse.
      rt.cycleTick++;
      if (rt.cycleTick >= gLen) {
        rt.cycleCount++;
        rt.cycleTick = 0;
      }
      rt.pitchIdx = advance(rt.pitchIdx, pLen, dir, rt, false);
      rt.gateIdx = advance(rt.gateIdx, gLen, dir, rt, true);
    }
  }
}

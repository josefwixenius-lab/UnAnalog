import * as Tone from 'tone';
import type { Pattern, PitchStep, GateStep, ScaleName } from './types';
import { midiToNearestDegree } from './scales';

/**
 * Realtime loop-recorder: lyssnar på MIDI-in medan sequencern spelar och
 * skriver inkommande noter direkt in i det aktiva spårets pitch- och
 * gate-steg. Loopen fortsätter spela som vanligt så du kan jamma ovanpå
 * och höra dig själv tillsammans med resten av patterns.
 *
 * Tidsmappning: vi läser `Tone.getTransport().ticks` vid note-on/off.
 * Stepsize = PPQ / 4 (en sextondel). stepIdx = Math.round(ticks/stepSize)
 * mod stepCount → auto-kvantisering till 1/16-gridden.
 *
 * Gate-längd: vid note-off räknas durationen i sextondelar. Om noten är
 * kortare än ett step → gate < 1 (staccato). Om längre → clamp till 1
 * (sustain för hela stepet). Multi-step-noter läggs bara in på sitt
 * ursprungliga step — användaren kan alltid redigera i step-editorn.
 *
 * Overdub: om stepet redan har en ton läggs den nya som extraNote
 * (ackord byggs upp). Vill man ersätta måste man rensa raden först (§10).
 */

type ActiveNote = {
  tickOn: number;
  stepIdx: number;
  velocity: number;
  /** Om note-on lades som huvudton (true) eller som extraNote (false) */
  isPrimary: boolean;
};

export type RecorderCallbacks = {
  /**
   * Uppdatera pattern. Tar en partial patcher som muteras på aktuellt
   * spårs pitchSteps/gateSteps. Implementationen använder patternRef för
   * att hämta "senaste" pattern, då callbacken kan anropas mitt i en
   * React-render.
   */
  onUpdate: (
    mutate: (pitchSteps: PitchStep[], gateSteps: GateStep[]) => void,
  ) => void;
};

export class LoopRecorder {
  private activeNotes = new Map<number, ActiveNote>();
  private getRoot: () => number;
  private getBaseOctave: () => number;
  private getScale: () => ScaleName;
  private getStepCount: () => number;
  private cb: RecorderCallbacks;

  constructor(
    getRoot: () => number,
    getBaseOctave: () => number,
    getScale: () => ScaleName,
    getStepCount: () => number,
    cb: RecorderCallbacks,
  ) {
    this.getRoot = getRoot;
    this.getBaseOctave = getBaseOctave;
    this.getScale = getScale;
    this.getStepCount = getStepCount;
    this.cb = cb;
  }

  /** Ska anropas med tick när Transport har faktiskt startat och nått 0. */
  onNoteOn(midi: number, velocity: number) {
    const transport = Tone.getTransport();
    const ppq = Tone.Transport.PPQ;
    const stepSize = ppq / 4; // 16:e-del
    const tick = transport.ticks;
    const stepCount = this.getStepCount();
    const stepIdx = Math.round(tick / stepSize) % stepCount;

    const { scaleDegree, octaveOffset, semitoneOffset } = midiToNearestDegree(
      midi,
      this.getRoot(),
      this.getBaseOctave(),
      this.getScale(),
    );

    let isPrimary = true;

    this.cb.onUpdate((pitchSteps, gateSteps) => {
      if (stepIdx >= pitchSteps.length) return;
      const existingPitch = pitchSteps[stepIdx];
      const existingGate = gateSteps[stepIdx];

      if (!existingGate?.active) {
        // Tomt step — skriv in som huvudton. semitoneOffset bevarar exakt
        // tonen användaren spelade även om den ligger utanför skalan.
        pitchSteps[stepIdx] = {
          ...existingPitch,
          scaleDegree,
          octaveOffset,
          semitoneOffset: semitoneOffset !== 0 ? semitoneOffset : undefined,
          slide: existingPitch?.slide ?? false,
          extraNotes: [],
        };
        gateSteps[stepIdx] = {
          ...existingGate,
          active: true,
          // Preliminär gate 1.0 — justeras vid note-off
          gate: 1.0,
          velocity,
          accent: velocity > 0.85,
          // Behåll befintliga värden för probability, ratchet, condition osv
          probability: existingGate?.probability ?? 1,
          ratchet: existingGate?.ratchet ?? 1,
          condition: existingGate?.condition ?? 'always',
          filterLock: existingGate?.filterLock ?? null,
          nudge: existingGate?.nudge ?? 0,
        };
      } else {
        // Overdub: lägg till som extraNote så ackord byggs upp
        isPrimary = false;
        const currentExtras = existingPitch.extraNotes ?? [];
        const already = currentExtras.some(
          (n) =>
            n.scaleDegree === scaleDegree &&
            n.octaveOffset === octaveOffset &&
            (n.semitoneOffset ?? 0) === semitoneOffset,
        );
        const alreadyMain =
          existingPitch.scaleDegree === scaleDegree &&
          existingPitch.octaveOffset === octaveOffset &&
          (existingPitch.semitoneOffset ?? 0) === semitoneOffset;
        if (!already && !alreadyMain) {
          pitchSteps[stepIdx] = {
            ...existingPitch,
            extraNotes: [
              ...currentExtras,
              {
                scaleDegree,
                octaveOffset,
                ...(semitoneOffset !== 0 ? { semitoneOffset } : {}),
              },
            ],
          };
        }
      }
    });

    this.activeNotes.set(midi, { tickOn: tick, stepIdx, velocity, isPrimary });
  }

  onNoteOff(midi: number) {
    const active = this.activeNotes.get(midi);
    if (!active) return;
    this.activeNotes.delete(midi);
    if (!active.isPrimary) return; // Bara huvudnoten bestämmer gate-längden

    const transport = Tone.getTransport();
    const ppq = Tone.Transport.PPQ;
    const stepSize = ppq / 4;
    const durationTicks = transport.ticks - active.tickOn;
    const durationSteps = durationTicks / stepSize;

    // Staccato → gate < 1. Sustain eller längre → gate = 1.
    // Minimum 0.1 så noten alltid är hörbar (annars blir den typ 1 ms).
    const gate = Math.max(0.1, Math.min(1.0, durationSteps));
    const stepIdx = active.stepIdx;

    this.cb.onUpdate((_pitchSteps, gateSteps) => {
      if (stepIdx >= gateSteps.length) return;
      const g = gateSteps[stepIdx];
      if (!g) return;
      gateSteps[stepIdx] = { ...g, gate };
    });
  }

  /** Rensa alla pågående noter (t.ex. vid stop). Triggar inte fler updates. */
  reset() {
    this.activeNotes.clear();
  }
}

/**
 * Hjälpare: skapa en ny version av pattern där det aktiva spårets pitch-
 * och gate-steg har muterats enligt callbacken. Behåller övriga fält.
 */
export function applyRecorderMutation(
  pattern: Pattern,
  mutate: (pitchSteps: PitchStep[], gateSteps: GateStep[]) => void,
): Pattern {
  const idx = pattern.tracks.findIndex((t) => t.id === pattern.activeTrackId);
  if (idx < 0) return pattern;
  const track = pattern.tracks[idx];
  const nextPitch = track.pitchSteps.slice();
  const nextGate = track.gateSteps.slice();
  mutate(nextPitch, nextGate);
  const nextTrack = { ...track, pitchSteps: nextPitch, gateSteps: nextGate };
  const nextTracks = pattern.tracks.slice();
  nextTracks[idx] = nextTrack;
  return { ...pattern, tracks: nextTracks };
}

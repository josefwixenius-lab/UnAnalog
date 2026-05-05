import { Midi } from '@tonejs/midi';
import type { Pattern, TrigCondition, Track } from './types';
import { degreeToMidi } from './scales';

/**
 * MIDI-export (Standard MIDI File Type 1).
 *
 * Renderar ett antal takter av ett `Pattern` till en .mid-fil. Varje spår blir
 * en egen MIDI-track med sin midi-kanal, respekterar polymeter (pitch/gate-
 * längd), ratchet, nudge, villkor, probability, extra-noter (ackord) och
 * accent/velocity. Swing, LFO och filter-lock ignoreras i exporten (de är
 * ljudspecifika eller icke-deterministiska).
 *
 * Om man stegar i samma ordning som sequencer.ts blir exporten ett exakt
 * avtryck av det man hör.
 */

export type MidiExportOptions = {
  bars: number; // Hur många takter att rendera (1..64). Default 4.
  fileName?: string | null; // Utelämna eller null → auto-datum.
  /**
   * Om `true` rullar villkor/probability som i live-läge (stokastiskt). Default
   * `false` → deterministiskt genom att behandla probability=1.0 och
   * villkoren utifrån cycle-count från takt 0.
   */
  randomize?: boolean;
  /**
   * Filtrera till specifika spår (track-id). Tom/utelämnad = alla spår.
   * Användbart när man bara vill exportera lead till en separat synth utan
   * att ta med trummor/bass.
   */
  trackIds?: string[];
};

const STEPS_PER_BAR = 16;

function evalCondition(
  c: TrigCondition,
  cycleCount: number,
  prevFired: boolean,
  fillActive: boolean,
  randomize: boolean,
): boolean {
  switch (c) {
    case 'always':
      return true;
    case 'p25':
      return randomize ? Math.random() < 0.25 : true;
    case 'p50':
      return randomize ? Math.random() < 0.5 : true;
    case 'p75':
      return randomize ? Math.random() < 0.75 : true;
    case '1:2':
      return cycleCount % 2 === 0;
    case '2:2':
      return cycleCount % 2 === 1;
    case '1:3':
      return cycleCount % 3 === 0;
    case '2:3':
      return cycleCount % 3 === 1;
    case '3:3':
      return cycleCount % 3 === 2;
    case '1:4':
      return cycleCount % 4 === 0;
    case '2:4':
      return cycleCount % 4 === 1;
    case '3:4':
      return cycleCount % 4 === 2;
    case '4:4':
      return cycleCount % 4 === 3;
    case 'notPrev':
      return !prevFired;
    case 'prev':
      return prevFired;
    case 'fill':
      return fillActive;
    case 'notFill':
      return !fillActive;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeVelocity(baseVelocity: number, accent: boolean, jitter: number, randomize: boolean): number {
  let v = baseVelocity;
  if (accent) v = Math.min(1, v + 0.2);
  if (randomize && jitter > 0) {
    const r = (Math.random() * 2 - 1) * jitter;
    v = v * (1 + r);
  }
  return clamp(v, 0.05, 1);
}

/**
 * Renderar ett enskilt spår över N takter och lägger till noter på den givna
 * Midi-tracken. Tickskalan följer `ppq`.
 */
function renderTrack(
  midiTrack: ReturnType<Midi['addTrack']>,
  track: Track,
  pattern: Pattern,
  ppq: number,
  bars: number,
  randomize: boolean,
) {
  const ticksPerStep = ppq / 4; // 16-delssteg
  const totalSteps = bars * STEPS_PER_BAR;

  midiTrack.name = track.name;
  // channel 1..16 i UI motsvarar 0..15 i SMF
  midiTrack.channel = clamp(track.midiChannel - 1, 0, 15);

  const pitchLen = Math.max(1, track.pitchSteps.length);
  const gateLen = Math.max(1, track.gateSteps.length);

  let pitchIdx = 0;
  let gateIdx = 0;
  let cycleCount = 0;
  let prevFired = false;

  for (let s = 0; s < totalSteps; s++) {
    const pitch = track.pitchSteps[pitchIdx];
    const gate = track.gateSteps[gateIdx];

    let fired = false;

    if (pitch && gate && gate.active && track.enabled) {
      const condPass = evalCondition(
        gate.condition,
        cycleCount,
        prevFired,
        pattern.fillActive,
        randomize,
      );
      const probPass = randomize ? Math.random() <= gate.probability : gate.probability >= 0.5;

      if (condPass && probPass) {
        fired = true;
        const allNotes = [
          {
            scaleDegree: pitch.scaleDegree,
            octaveOffset: pitch.octaveOffset,
            semitoneOffset: pitch.semitoneOffset ?? 0,
          },
          ...(pitch.extraNotes ?? []),
        ];
        const midis = allNotes.map((n) =>
          degreeToMidi(
            pattern.rootNote,
            pattern.baseOctave + track.octaveShift,
            pattern.scale,
            n.scaleDegree,
            n.octaveOffset,
            n.semitoneOffset ?? 0,
          ),
        );

        const ratchet = Math.max(1, Math.min(4, gate.ratchet));
        const subTicks = Math.floor(ticksPerStep / ratchet);
        const gateFrac = Math.max(0.05, Math.min(1, gate.gate));
        const durTicks = Math.max(1, Math.floor(subTicks * gateFrac));
        const baseVel = typeof gate.velocity === 'number' ? gate.velocity : 0.8;
        const jitter = typeof track.velocityJitter === 'number' ? track.velocityJitter : 0;
        const nudgeFrac = clamp(typeof gate.nudge === 'number' ? gate.nudge : 0, -0.5, 0.5);
        const nudgeTicks = Math.round(nudgeFrac * ticksPerStep);

        // Hats spelar bara första tonen (matchar sequencer-beteendet)
        const isNoise = track.voice === 'hats';
        const notesToPlay = isNoise ? [midis[0]] : midis;

        for (let r = 0; r < ratchet; r++) {
          const baseTick = s * ticksPerStep + r * subTicks + nudgeTicks;
          // Klipp bort negativa ticks (första steget med negativ nudge)
          if (baseTick < 0) continue;
          const velocity = computeVelocity(baseVel, gate.accent, jitter, randomize);
          for (const midiNote of notesToPlay) {
            midiTrack.addNote({
              midi: midiNote,
              ticks: baseTick,
              durationTicks: durTicks,
              velocity,
            });
          }
        }
      }
    }

    prevFired = fired;

    const nextPitch = (pitchIdx + 1) % pitchLen;
    const nextGate = (gateIdx + 1) % gateLen;
    if (nextGate === 0) cycleCount++;
    pitchIdx = nextPitch;
    gateIdx = nextGate;
  }

  // Lägg ett explicit end-of-track-tick vid takten slut om biblioteket inte
  // gör det automatiskt. Bibl. skriver EOT efter sista noten, men för tomma
  // spår behövs detta.
  midiTrack.endOfTrackTicks = totalSteps * ticksPerStep;
}

/**
 * Bygger och laddar ner en .mid-fil av det aktiva mönstret.
 */
export function exportPatternToMidi(
  pattern: Pattern,
  options: MidiExportOptions,
): { bytes: Uint8Array; fileName: string } {
  const bars = Math.max(1, Math.min(64, Math.floor(options.bars || 4)));
  const randomize = options.randomize ?? false;

  const midi = new Midi();
  midi.header.setTempo(pattern.tempo);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }];
  midi.header.name = 'UnAnalog Sequencer';

  const ppq = midi.header.ppq;

  const idFilter = options.trackIds && options.trackIds.length > 0
    ? new Set(options.trackIds)
    : null;
  const tracksToExport = idFilter
    ? pattern.tracks.filter((t) => idFilter.has(t.id))
    : pattern.tracks;
  for (const track of tracksToExport) {
    const mt = midi.addTrack();
    renderTrack(mt, track, pattern, ppq, bars, randomize);
  }

  const bytes = midi.toArray();

  const name = options.fileName?.trim();
  const fileName = name
    ? name.endsWith('.mid') ? name : `${name}.mid`
    : autoFileName();

  return { bytes, fileName };
}

function autoFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `unanalog-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.mid`;
}

/**
 * Hjälpfunktion: triggar webbläsar-nedladdning av den genererade .mid-filen.
 */
export function downloadPatternAsMidi(pattern: Pattern, options: MidiExportOptions) {
  const { bytes, fileName } = exportPatternToMidi(pattern, options);
  const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Ge browsern en tick innan vi återbördar URLen
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

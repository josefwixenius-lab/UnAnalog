import * as Tone from 'tone';

export type MidiOut = {
  id: string;
  name: string;
  port: MIDIOutput;
};

export async function getMidiOutputs(): Promise<MidiOut[]> {
  if (!('requestMIDIAccess' in navigator)) return [];
  const access = await navigator.requestMIDIAccess({ sysex: false });
  const outs: MidiOut[] = [];
  access.outputs.forEach((port) => {
    outs.push({ id: port.id, name: port.name ?? 'MIDI', port });
  });
  return outs;
}

function audioTimeToPerfMs(whenAudioSec: number): number {
  const audioNow = Tone.getContext().currentTime;
  const perfNow = performance.now();
  return perfNow + Math.max(0, (whenAudioSec - audioNow) * 1000);
}

export function sendMidiNote(
  out: MIDIOutput,
  channel: number,
  midi: number,
  velocity: number,
  durationSec: number,
  whenAudioSec: number,
) {
  const ch = Math.max(0, Math.min(15, channel - 1));
  const vel = Math.max(1, Math.min(127, Math.round(velocity * 127)));
  const note = Math.max(0, Math.min(127, Math.round(midi)));
  const noteOn = [0x90 | ch, note, vel];
  const noteOff = [0x80 | ch, note, 0];
  const startMs = audioTimeToPerfMs(whenAudioSec);
  out.send(noteOn, startMs);
  out.send(noteOff, startMs + durationSec * 1000);
}

// --- MIDI Clock / Realtime ---
// 0xF8 Clock · 0xFA Start · 0xFB Continue · 0xFC Stop
export function sendMidiClockPulse(out: MIDIOutput, whenAudioSec: number) {
  out.send([0xf8], audioTimeToPerfMs(whenAudioSec));
}

export function sendMidiStart(out: MIDIOutput, whenAudioSec?: number) {
  out.send([0xfa], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
}

export function sendMidiContinue(out: MIDIOutput, whenAudioSec?: number) {
  out.send([0xfb], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
}

export function sendMidiStop(out: MIDIOutput, whenAudioSec?: number) {
  out.send([0xfc], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
}

export function panicMidi(out: MIDIOutput, channel: number) {
  const ch = Math.max(0, Math.min(15, channel - 1));
  out.send([0xb0 | ch, 123, 0]);
}

export type MidiIn = {
  id: string;
  name: string;
  port: MIDIInput;
};

export async function getMidiInputs(): Promise<MidiIn[]> {
  if (!('requestMIDIAccess' in navigator)) return [];
  const access = await navigator.requestMIDIAccess({ sysex: false });
  const ins: MidiIn[] = [];
  access.inputs.forEach((port) => {
    ins.push({ id: port.id, name: port.name ?? 'MIDI In', port });
  });
  return ins;
}

export type ChordCaptureHandle = {
  stop: () => void;
};

type ChordCallbacks = {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onComplete: (midis: number[]) => void;
};

// --- MIDI Clock IN (extern master) ---

export type ClockInCallbacks = {
  onStart?: () => void;
  onStop?: () => void;
  onContinue?: () => void;
  /** BPM beräknad rullande från senaste ~24 clock-pulser (en kvartsnot). */
  onTempo?: (bpm: number) => void;
  /** Skickas när vi nyss har mottagit minst en pulse (för "connected"-indikator). */
  onPulse?: () => void;
};

export type ClockInHandle = { stop: () => void };

export function listenMidiClock(
  inputs: MIDIInput[],
  cb: ClockInCallbacks,
): ClockInHandle {
  const WINDOW = 24; // en kvartsnot
  const intervals: number[] = [];
  let lastPulseMs: number | null = null;
  let lastEmitMs = 0;

  const handler = (ev: Event) => {
    const msg = ev as MIDIMessageEvent;
    if (!msg.data || msg.data.length < 1) return;
    const status = msg.data[0];
    switch (status) {
      case 0xf8: {
        // Clock pulse — 24 per kvartsnot
        const now = performance.now();
        if (lastPulseMs !== null) {
          const dt = now - lastPulseMs;
          // Rimlighetsfilter: 5 ms (480 BPM) till 200 ms (12 BPM)
          if (dt > 5 && dt < 200) {
            intervals.push(dt);
            if (intervals.length > WINDOW) intervals.shift();
            // Emit BPM högst ~10 ggr/s för att inte spamma React-state
            if (intervals.length >= 8 && now - lastEmitMs > 100) {
              const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
              const bpm = 60000 / (avg * 24);
              if (bpm >= 20 && bpm <= 300) {
                cb.onTempo?.(bpm);
                lastEmitMs = now;
              }
            }
          }
        }
        lastPulseMs = now;
        cb.onPulse?.();
        break;
      }
      case 0xfa:
        // Start
        intervals.length = 0;
        lastPulseMs = null;
        cb.onStart?.();
        break;
      case 0xfb:
        // Continue
        cb.onContinue?.();
        break;
      case 0xfc:
        // Stop
        cb.onStop?.();
        break;
      default:
        break;
    }
  };

  for (const p of inputs) p.addEventListener('midimessage', handler);
  return {
    stop: () => {
      for (const p of inputs) p.removeEventListener('midimessage', handler);
    },
  };
}

// --- Sekvensinmatning: ton för ton, inmatningsordning bevaras ---

export type SequenceCaptureHandle = {
  /** Stäng lyssnaren utan att skicka in något. */
  cancel: () => void;
  /** Stäng lyssnaren och skicka in sekvensen som spelats hittills. */
  finish: () => void;
  /** Ta bort senast inspelade ton. */
  undo: () => void;
};

type SequenceCallbacks = {
  /** Varje gång en ny ton spelas, i ordning. */
  onNote: (midi: number, allSoFar: number[]) => void;
  /** Används när finish() anropas. Tom lista ger ingen callback. */
  onFinish: (midis: number[]) => void;
  /** Används när undo() anropas. */
  onUndo: (allSoFar: number[]) => void;
};

/**
 * Liknar captureChord men bygger upp en sekvens i inmatningsordning.
 * Paus mellan toner är OK — avslut sker bara via finish()/cancel().
 */
export function captureSequence(
  ports: MIDIInput[],
  cb: SequenceCallbacks,
): SequenceCaptureHandle {
  const sequence: number[] = [];

  const handler = (ev: Event) => {
    const msg = ev as MIDIMessageEvent;
    if (!msg.data || msg.data.length < 2) return;
    const status = msg.data[0];
    const note = msg.data[1];
    const velRaw = msg.data[2];
    const cmd = status & 0xf0;
    const vel = velRaw ?? 0;
    // Vi bryr oss bara om note-on för sekvensen
    if (cmd === 0x90 && vel > 0) {
      sequence.push(note);
      cb.onNote(note, sequence.slice());
    }
  };

  for (const p of ports) p.addEventListener('midimessage', handler);

  const detach = () => {
    for (const p of ports) p.removeEventListener('midimessage', handler);
  };

  return {
    cancel: () => detach(),
    finish: () => {
      detach();
      cb.onFinish(sequence.slice());
    },
    undo: () => {
      sequence.pop();
      cb.onUndo(sequence.slice());
    },
  };
}

export function captureChord(ports: MIDIInput[], cb: ChordCallbacks): ChordCaptureHandle {
  const heldNow = new Set<number>();
  const captured: number[] = [];
  let anyPressed = false;

  const handler = (ev: Event) => {
    const msg = ev as MIDIMessageEvent;
    if (!msg.data || msg.data.length < 2) return;
    const status = msg.data[0];
    const note = msg.data[1];
    const velRaw = msg.data[2];
    const cmd = status & 0xf0;
    const vel = velRaw ?? 0;
    if (cmd === 0x90 && vel > 0) {
      if (!heldNow.has(note) && !captured.includes(note)) {
        captured.push(note);
        cb.onNoteOn(note);
      }
      heldNow.add(note);
      anyPressed = true;
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      heldNow.delete(note);
      cb.onNoteOff(note);
      if (anyPressed && heldNow.size === 0 && captured.length > 0) {
        cb.onComplete(captured.slice());
        captured.length = 0;
        anyPressed = false;
      }
    }
  };

  for (const p of ports) p.addEventListener('midimessage', handler);
  return {
    stop: () => {
      for (const p of ports) p.removeEventListener('midimessage', handler);
    },
  };
}

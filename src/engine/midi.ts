import * as Tone from 'tone';

export type MidiOut = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  port: MIDIOutput;
};

export type MidiIn = {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  connection: 'open' | 'closed' | 'pending';
  port: MIDIInput;
};

// ---------------------------------------------------------------------------
// Delad MIDIAccess + statechange-broker + auto-open
// ---------------------------------------------------------------------------
//
// Tidigare kallade vi `navigator.requestMIDIAccess()` separat per hämtning,
// och ingen statechange-lyssnare fanns. Det gav två typiska problem:
//  1. Trummaskinen som kopplades in EFTER sidladdning syntes aldrig (man
//     tvingades reload:a sidan).
//  2. På Windows (och vissa macOS-drivrutiner) är MIDI-portar "closed" tills
//     man anropar `port.open()` — utan det kom inga meddelanden in/ut.
//
// Den här modulen cachar en MIDIAccess, auto-öppnar alla portar, och
// notifierar prenumeranter när listan ändras.

let _access: MIDIAccess | null = null;
let _accessPromise: Promise<MIDIAccess | null> | null = null;
let _accessError: string | null = null;
const _portListeners = new Set<() => void>();

function openSafely(port: MIDIPort) {
  try {
    const result = port.open();
    if (result && typeof (result as Promise<MIDIPort>).then === 'function') {
      (result as Promise<MIDIPort>).catch((e) =>
        console.warn('[MIDI] open() failed on', port.name, e),
      );
    }
  } catch (e) {
    console.warn('[MIDI] open() threw on', port.name, e);
  }
}

async function initAccess(): Promise<MIDIAccess | null> {
  if (!('requestMIDIAccess' in navigator)) {
    _accessError = 'Web MIDI stöds inte i denna webbläsare (Chrome eller Edge krävs).';
    return null;
  }
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    _access = access;
    _accessError = null;

    // Öppna alla befintliga portar
    access.inputs.forEach(openSafely);
    access.outputs.forEach(openSafely);

    // Fånga alla port-in/out-händelser
    access.addEventListener('statechange', (ev) => {
      const port = (ev as MIDIConnectionEvent).port;
      if (port && port.state === 'connected' && port.connection === 'closed') {
        openSafely(port);
      }
      for (const fn of _portListeners) {
        try {
          fn();
        } catch (e) {
          console.warn('[MIDI] port listener threw:', e);
        }
      }
    });

    return access;
  } catch (e) {
    _accessError = `MIDI-åtkomst nekades eller misslyckades: ${(e as Error).message}`;
    console.error('[MIDI] requestMIDIAccess failed:', e);
    _accessPromise = null;
    return null;
  }
}

export async function getMidiAccess(): Promise<MIDIAccess | null> {
  if (_access) return _access;
  if (_accessPromise) return _accessPromise;
  _accessPromise = initAccess();
  return _accessPromise;
}

export function getMidiAccessError(): string | null {
  return _accessError;
}

/**
 * Prenumerera på port-ändringar (anslutna/frånkopplade/konfigurerade).
 * Callbacken körs varje gång listan ändras, så du kan re-hämta portar.
 * Returnerar en unsubscribe-funktion.
 */
export function subscribeMidiPorts(fn: () => void): () => void {
  _portListeners.add(fn);
  void getMidiAccess();
  return () => {
    _portListeners.delete(fn);
  };
}

function describeInput(port: MIDIInput): MidiIn {
  return {
    id: port.id,
    name: port.name ?? 'MIDI In',
    manufacturer: port.manufacturer ?? '',
    state: port.state,
    connection: port.connection,
    port,
  };
}

function describeOutput(port: MIDIOutput): MidiOut {
  return {
    id: port.id,
    name: port.name ?? 'MIDI',
    manufacturer: port.manufacturer ?? '',
    state: port.state,
    connection: port.connection,
    port,
  };
}

export async function getMidiOutputs(): Promise<MidiOut[]> {
  const access = await getMidiAccess();
  if (!access) return [];
  const outs: MidiOut[] = [];
  access.outputs.forEach((port) => {
    if (port.state === 'connected') outs.push(describeOutput(port));
  });
  return outs;
}

export async function getMidiInputs(): Promise<MidiIn[]> {
  const access = await getMidiAccess();
  if (!access) return [];
  const ins: MidiIn[] = [];
  access.inputs.forEach((port) => {
    if (port.state === 'connected') ins.push(describeInput(port));
  });
  return ins;
}

/**
 * Tvinga re-read: useful efter att användaren kopplat in en enhet om
 * statechange av nån anledning inte fyrats av (sker på en del Windows-system).
 */
export async function refreshMidiPorts(): Promise<void> {
  const access = await getMidiAccess();
  if (!access) return;
  access.inputs.forEach(openSafely);
  access.outputs.forEach(openSafely);
  for (const fn of _portListeners) fn();
}

// ---------------------------------------------------------------------------
// Tajming-hjälpare
// ---------------------------------------------------------------------------

function audioTimeToPerfMs(whenAudioSec: number): number {
  const audioNow = Tone.getContext().currentTime;
  const perfNow = performance.now();
  return perfNow + Math.max(0, (whenAudioSec - audioNow) * 1000);
}

// ---------------------------------------------------------------------------
// Send-sidan
// ---------------------------------------------------------------------------
//
// Vi håller en liten "tap" som diagnostikpanelen kan prenumerera på för att
// visa en live-LED varje gång vi skickar en clock-puls / note / start/stop.
// Det här är billigt (bara en set-iteration per sändning) och ger dig direkt
// återkoppling när du försöker felsöka en synk.

type SendEvent =
  | { type: 'clock'; outId: string }
  | { type: 'start' | 'stop' | 'continue'; outId: string }
  | { type: 'note'; outId: string; channel: number; midi: number };

const _sendTaps = new Set<(e: SendEvent) => void>();

export function tapMidiSend(fn: (e: SendEvent) => void): () => void {
  _sendTaps.add(fn);
  return () => {
    _sendTaps.delete(fn);
  };
}

function emitSend(e: SendEvent) {
  for (const fn of _sendTaps) {
    try {
      fn(e);
    } catch {
      // ignore
    }
  }
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
  try {
    out.send(noteOn, startMs);
    out.send(noteOff, startMs + durationSec * 1000);
    emitSend({ type: 'note', outId: out.id, channel, midi: note });
  } catch (e) {
    console.warn('[MIDI] sendMidiNote failed:', e);
  }
}

// --- MIDI Clock / Realtime ---
// 0xF8 Clock · 0xFA Start · 0xFB Continue · 0xFC Stop
export function sendMidiClockPulse(out: MIDIOutput, whenAudioSec: number) {
  try {
    out.send([0xf8], audioTimeToPerfMs(whenAudioSec));
    emitSend({ type: 'clock', outId: out.id });
  } catch (e) {
    console.warn('[MIDI] sendMidiClockPulse failed:', e);
  }
}

export function sendMidiStart(out: MIDIOutput, whenAudioSec?: number) {
  try {
    out.send([0xfa], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
    emitSend({ type: 'start', outId: out.id });
  } catch (e) {
    console.warn('[MIDI] sendMidiStart failed:', e);
  }
}

export function sendMidiContinue(out: MIDIOutput, whenAudioSec?: number) {
  try {
    out.send([0xfb], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
    emitSend({ type: 'continue', outId: out.id });
  } catch (e) {
    console.warn('[MIDI] sendMidiContinue failed:', e);
  }
}

export function sendMidiStop(out: MIDIOutput, whenAudioSec?: number) {
  try {
    out.send([0xfc], whenAudioSec != null ? audioTimeToPerfMs(whenAudioSec) : performance.now());
    emitSend({ type: 'stop', outId: out.id });
  } catch (e) {
    console.warn('[MIDI] sendMidiStop failed:', e);
  }
}

export function panicMidi(out: MIDIOutput, channel: number) {
  const ch = Math.max(0, Math.min(15, channel - 1));
  try {
    out.send([0xb0 | ch, 123, 0]);
  } catch (e) {
    console.warn('[MIDI] panicMidi failed:', e);
  }
}

/**
 * Skicka en testnot på vald kanal och enhet. Fire-and-forget. Används av
 * diagnostik-panelen så du kan verifiera att MIDI Ut fungerar överhuvudtaget
 * innan du börjar bråka med clock-sync.
 */
export function sendTestNote(out: MIDIOutput, channel = 1, midi = 60, durationMs = 200) {
  const ch = Math.max(0, Math.min(15, channel - 1));
  const note = Math.max(0, Math.min(127, Math.round(midi)));
  const start = performance.now();
  try {
    out.send([0x90 | ch, note, 100], start);
    out.send([0x80 | ch, note, 0], start + durationMs);
    emitSend({ type: 'note', outId: out.id, channel, midi: note });
  } catch (e) {
    console.warn('[MIDI] sendTestNote failed:', e);
  }
}

/**
 * Skicka en komplett test-sekvens: Start → 96 clockpulser (4 kvartsnoter,
 * en takt @ 4/4) @ ~120 BPM → Stop. Om trummaskinen är riktigt konfigurerad
 * ska den pulsera med i exakt en takt och sen stanna.
 *
 * Tajmingen sker via `performance.now()`-tidsstämplar vilket är det mest
 * portabla över Chrome-versioner/OS. Chrome respekterar tidsstämplarna för
 * MIDI-output i de allra flesta fall.
 */
export function sendClockTestBurst(out: MIDIOutput, bpm = 120, bars = 1) {
  const pulsesPerBar = 96; // 24 PPQ × 4 kvarter
  const totalPulses = pulsesPerBar * bars;
  const msPerPulse = 60000 / (bpm * 24);
  const t0 = performance.now() + 20;
  try {
    out.send([0xfa], t0);
    emitSend({ type: 'start', outId: out.id });
    for (let i = 0; i < totalPulses; i++) {
      out.send([0xf8], t0 + i * msPerPulse);
      emitSend({ type: 'clock', outId: out.id });
    }
    out.send([0xfc], t0 + totalPulses * msPerPulse + 5);
    emitSend({ type: 'stop', outId: out.id });
  } catch (e) {
    console.warn('[MIDI] sendClockTestBurst failed:', e);
  }
}

// ---------------------------------------------------------------------------
// MIDI Clock IN (extern master)
// ---------------------------------------------------------------------------

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

  for (const p of inputs) {
    openSafely(p);
    p.addEventListener('midimessage', handler);
  }
  return {
    stop: () => {
      for (const p of inputs) p.removeEventListener('midimessage', handler);
    },
  };
}

/**
 * En kraftigt simplifierad lyssnare som bara tickar en callback för varje
 * MIDI-meddelande (note-on, clock, cc…). Används av diagnostik-panelen för
 * att visa "senaste mottagna"-indikator. Skilt från clock-lyssnaren så de
 * kan finnas samtidigt utan att kliva på varandra.
 */
export type AnyMidiMessage = {
  status: number;
  data: Uint8Array;
  portId: string;
  portName: string;
};

export function tapMidiInputs(
  inputs: MIDIInput[],
  cb: (m: AnyMidiMessage) => void,
): () => void {
  const handler = (port: MIDIInput) => (ev: Event) => {
    const msg = ev as MIDIMessageEvent;
    if (!msg.data) return;
    cb({
      status: msg.data[0],
      data: new Uint8Array(msg.data),
      portId: port.id,
      portName: port.name ?? 'MIDI In',
    });
  };
  const wired: Array<[MIDIInput, (ev: Event) => void]> = [];
  for (const p of inputs) {
    openSafely(p);
    const h = handler(p);
    p.addEventListener('midimessage', h);
    wired.push([p, h]);
  }
  return () => {
    for (const [p, h] of wired) p.removeEventListener('midimessage', h);
  };
}

// ---------------------------------------------------------------------------
// Sekvens- och ackord-inmatning (oförändrat)
// ---------------------------------------------------------------------------

export type SequenceCaptureHandle = {
  cancel: () => void;
  finish: () => void;
  undo: () => void;
};

type SequenceCallbacks = {
  onNote: (midi: number, allSoFar: number[]) => void;
  onFinish: (midis: number[]) => void;
  onUndo: (allSoFar: number[]) => void;
};

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
    if (cmd === 0x90 && vel > 0) {
      sequence.push(note);
      cb.onNote(note, sequence.slice());
    }
  };

  for (const p of ports) {
    openSafely(p);
    p.addEventListener('midimessage', handler);
  }

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

export type ChordCaptureHandle = {
  stop: () => void;
};

type ChordCallbacks = {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onComplete: (midis: number[]) => void;
};

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

  for (const p of ports) {
    openSafely(p);
    p.addEventListener('midimessage', handler);
  }
  return {
    stop: () => {
      for (const p of ports) p.removeEventListener('midimessage', handler);
    },
  };
}

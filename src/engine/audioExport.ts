import * as Tone from 'tone';
import type { Pattern, PlayDirection, TrigCondition } from './types';
import { degreeToMidi } from './scales';
import { createVoice } from './voices';
import { createOfflineBus, TrackFxChain } from './audioBus';

/**
 * WAV-export via Tone.Offline.
 *
 * Bygger en helt fristående audio-graf inne i offline-kontexten — samma
 * voice + FX-kedja som live-läget använder, så reverb/chorus/bitcrusher/
 * shimmer/sidechain hörs i exporten lika som i appen. Renderar deterministiskt
 * (ingen probability-rullning, inga mute-grupp-toggle:s — pattern.mutedGroups
 * och fillActive används som-de-är vid export-tid).
 *
 * Resultatet konverteras till en 16-bit PCM stereo WAV-fil och laddas ner.
 */

export type WavExportOptions = {
  bars: number;
  fileName?: string | null;
  /** Sample-rate. Default 44100. */
  sampleRate?: number;
  /** Antal sekunder extra rendering efter sista step:et för att fånga reverb-svans. */
  tailSec?: number;
};

const STEPS_PER_BAR = 16;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function evalCondition(
  c: TrigCondition,
  cycleCount: number,
  prevFired: boolean,
  fillActive: boolean,
): boolean {
  // Deterministiskt: probability-villkor räknas alltid som "passerar" (dvs.
  // 25%/50%/75% blir alla `true`). Användaren kan välja `randomize`-läget
  // för att få stokastik om de vill — men default är "hör samma sak varje gång".
  switch (c) {
    case 'always':
    case 'p25':
    case 'p50':
    case 'p75':
      return true;
    case '1:2': return cycleCount % 2 === 0;
    case '2:2': return cycleCount % 2 === 1;
    case '1:3': return cycleCount % 3 === 0;
    case '2:3': return cycleCount % 3 === 1;
    case '3:3': return cycleCount % 3 === 2;
    case '1:4': return cycleCount % 4 === 0;
    case '2:4': return cycleCount % 4 === 1;
    case '3:4': return cycleCount % 4 === 2;
    case '4:4': return cycleCount % 4 === 3;
    case 'notPrev': return !prevFired;
    case 'prev': return prevFired;
    case 'fill': return fillActive;
    case 'notFill': return !fillActive;
  }
}

function advance(
  cur: number,
  len: number,
  dir: PlayDirection,
  state: { pingDir: 1 | -1 },
): number {
  if (len <= 1) return 0;
  switch (dir) {
    case 'forward':
      return (cur + 1) % len;
    case 'reverse':
      return (cur - 1 + len) % len;
    case 'pingpong': {
      let next = cur + state.pingDir;
      if (next >= len) {
        state.pingDir = -1;
        next = Math.max(0, len - 2);
      } else if (next < 0) {
        state.pingDir = 1;
        next = Math.min(len - 1, 1);
      }
      return next;
    }
    case 'pingpongHold': {
      let next = cur + state.pingDir;
      if (next >= len) {
        state.pingDir = -1;
        next = len - 1;
      } else if (next < 0) {
        state.pingDir = 1;
        next = 0;
      }
      return next;
    }
    case 'random':
      return Math.floor(Math.random() * len);
    case 'brownian': {
      const delta = Math.floor(Math.random() * 3) - 1;
      return ((cur + delta) % len + len) % len;
    }
  }
}

/**
 * Renderar pattern till en ToneAudioBuffer i offline-kontexten. Bars + tempo
 * styr längden; tailSec tjänar som "låt reverb-svansarna dö ut" efter sista
 * notens trigger.
 */
async function renderPatternOffline(
  pattern: Pattern,
  bars: number,
  sampleRate: number,
  tailSec: number,
): Promise<Tone.ToneAudioBuffer> {
  const stepSec = 60 / pattern.tempo / 4; // 16-delssteg
  const totalSteps = bars * STEPS_PER_BAR;
  const totalDurSec = totalSteps * stepSec + tailSec;

  return await Tone.Offline(async (ctx) => {
    const offline = createOfflineBus(ctx.destination);

    type TrackRig = {
      track: Pattern['tracks'][number];
      voice: ReturnType<typeof createVoice>;
      fxChain: TrackFxChain;
    };

    const rigs: TrackRig[] = pattern.tracks.map((track) => {
      const voice = createVoice(track.voice);
      voice.setVolume(track.volumeDb);
      voice.setFilterBase(track.filterCutoff, track.filterResonance);
      voice.setLfo(track.lfo);
      const fxChain = new TrackFxChain(track.fx, offline.ctx);
      fxChain.setPan(track.pan ?? 0);
      voice.connectOutput(fxChain.getInput());
      return { track, voice, fxChain };
    });

    // Per-spår runtime-state (matchar sequencer.ts ungefär)
    type Rt = {
      pitchIdx: number;
      gateIdx: number;
      pitchPing: { pingDir: 1 | -1 };
      gatePing: { pingDir: 1 | -1 };
      cycleCount: number;
      cycleTick: number;
      prevFired: boolean;
    };
    const rts = new Map<string, Rt>();
    for (const t of pattern.tracks) {
      const dir = t.playDirection ?? 'forward';
      rts.set(t.id, {
        pitchIdx: dir === 'reverse' ? Math.max(0, t.pitchSteps.length - 1) : 0,
        gateIdx: dir === 'reverse' ? Math.max(0, t.gateSteps.length - 1) : 0,
        pitchPing: { pingDir: 1 },
        gatePing: { pingDir: 1 },
        cycleCount: 0,
        cycleTick: 0,
        prevFired: false,
      });
    }

    const anySolo = pattern.tracks.some((t) => t.solo);

    for (let s = 0; s < totalSteps; s++) {
      const stepStart = s * stepSec;
      const isOffBeat = s % 2 === 1;

      for (const rig of rigs) {
        const t = rig.track;
        const rt = rts.get(t.id);
        if (!rt) continue;
        const gate = t.gateSteps[rt.gateIdx];
        const pitch = t.pitchSteps[rt.pitchIdx];
        const inMutedGroup =
          t.muteGroup != null && (pattern.mutedGroups?.includes(t.muteGroup) ?? false);
        const audible = t.enabled && !inMutedGroup && (!anySolo || t.solo);
        const trackSwing = t.swing ?? pattern.swing;
        const swingOffsetSec = isOffBeat ? trackSwing * (stepSec * 0.5) : 0;

        let fired = false;
        if (gate && pitch && gate.active && audible) {
          const condPass = evalCondition(
            gate.condition,
            rt.cycleCount,
            rt.prevFired,
            pattern.fillActive,
          );
          // Probability ≥ 0.5 = "ja" (deterministisk regel matchar midiExport)
          const probPass = gate.probability >= 0.5;
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
                pattern.baseOctave + t.octaveShift,
                pattern.scale,
                n.scaleDegree,
                n.octaveOffset,
                n.semitoneOffset ?? 0,
              ),
            );
            const ratchet = Math.max(1, Math.min(4, gate.ratchet));
            const subStep = stepSec / ratchet;
            const slideAmt = pitch.slide ? clamp(pitch.slideTime ?? 0.5, 0, 1) : 0;
            const slideExtra = slideAmt * stepSec * 0.85;
            const dur = Math.max(0.01, subStep * gate.gate + slideExtra);
            const baseVel = typeof gate.velocity === 'number' ? gate.velocity : 0.8;
            // Velocity-jitter avstängd i export — deterministisk = återupprepbart resultat
            const nudgeFrac = clamp(typeof gate.nudge === 'number' ? gate.nudge : 0, -0.5, 0.5);
            const nudgeSec = nudgeFrac * stepSec;

            // Sidechain-targets (samma logik som live)
            const duckTargets: Array<{ chain: TrackFxChain; amount: number; release: number }> = [];
            for (const tt of pattern.tracks) {
              if (tt.id === t.id) continue;
              if (tt.sidechainSourceId !== t.id) continue;
              const amt = tt.sidechainAmount ?? 0;
              if (amt <= 0) continue;
              const targetRig = rigs.find((r) => r.track.id === tt.id);
              if (!targetRig) continue;
              duckTargets.push({
                chain: targetRig.fxChain,
                amount: amt,
                release: tt.sidechainRelease ?? 0.18,
              });
            }

            const isNoise = t.voice === 'hats';
            const notesToPlay = isNoise ? [midis[0]] : midis;
            const accent = gate.accent;

            for (let r = 0; r < ratchet; r++) {
              const t0 = stepStart + swingOffsetSec + nudgeSec + r * subStep;
              if (t0 < 0) continue;
              let vel = baseVel;
              if (accent) vel = Math.min(1, vel + 0.2);
              vel = clamp(vel, 0.05, 1);
              for (const m of notesToPlay) {
                rig.voice.trigger(m, dur, t0, vel, { filterLock: gate.filterLock });
              }
              for (const dt of duckTargets) {
                dt.chain.applyDuck(t0, dt.amount, dt.release);
              }
            }
          }
        }

        rt.prevFired = fired;
        const dir = t.playDirection ?? 'forward';
        const pLen = Math.max(1, t.pitchSteps.length);
        const gLen = Math.max(1, t.gateSteps.length);
        rt.cycleTick++;
        if (rt.cycleTick >= gLen) {
          rt.cycleCount++;
          rt.cycleTick = 0;
        }
        rt.pitchIdx = advance(rt.pitchIdx, pLen, dir, rt.pitchPing);
        rt.gateIdx = advance(rt.gateIdx, gLen, dir, rt.gatePing);
      }
    }

    // Inget explicit dispose nödvändigt — Tone.Offline river ner kontexten
    // när callbacken returnerar och bufferten är klar.
  }, totalDurSec, 2, sampleRate);
}

/* ---------- WAV-encoding (16-bit PCM, RIFF) ---------- */

function audioBufferToWav(buf: AudioBuffer): Uint8Array {
  const numChannels = buf.numberOfChannels;
  const sampleRate = buf.sampleRate;
  const numFrames = buf.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size for PCM
  view.setUint16(20, 1, true); // format = 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave samples
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buf.getChannelData(c));
  let offset = headerSize;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      // Klippt till [-1, 1] sen 16-bit signed
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  return out;
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function autoFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `unanalog-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.wav`;
}

/**
 * Renderar pattern offline och triggar en WAV-nedladdning. Returnerar
 * filnamnet som användes (för UI-feedback).
 */
export async function exportPatternToWav(
  pattern: Pattern,
  options: WavExportOptions,
): Promise<{ fileName: string; sizeBytes: number }> {
  const bars = Math.max(1, Math.min(64, Math.floor(options.bars || 4)));
  const sampleRate = options.sampleRate ?? 44100;
  const tailSec = options.tailSec ?? 6;

  // Tone måste vara start:ad innan vi skapar offline-kontexten — annars kan
  // vissa Tone-konstanter som Time vara odefinierade. Live-Audio behöver inte
  // spela för det här.
  await Tone.start();

  const toneBuffer = await renderPatternOffline(pattern, bars, sampleRate, tailSec);
  const audioBuffer = toneBuffer.get();
  if (!audioBuffer) throw new Error('Offline-renderingen gav ingen audio-buffer.');

  const wav = audioBufferToWav(audioBuffer);
  const name = options.fileName?.trim();
  const fileName = name
    ? name.endsWith('.wav') ? name : `${name}.wav`
    : autoFileName();

  const blob = new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { fileName, sizeBytes: wav.byteLength };
}

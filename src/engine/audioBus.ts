import * as Tone from 'tone';
import type { TrackFx } from './types';

/**
 * Gemensam master-buss med limiter så det aldrig clippar, oavsett hur många
 * spår som spelar samtidigt eller vilka per-spår volymer användaren ställt in.
 *
 * Signalväg:
 *   voice → trackFxChain (dry + delay + reverb + saturation) → master → limiter → destination
 *
 * Alla voices `connect(getMasterInput())` istället för `.toDestination()`.
 * Delay- och reverb-nodes delas globalt (en instans per typ), men varje spår
 * har egna wet-gains så man kan dosa per spår utan att de hör varandras svans.
 */

let initialized = false;
let masterInput: Tone.Gain | null = null;
let masterVolume: Tone.Volume | null = null;
let limiter: Tone.Limiter | null = null;
let sharedDelay: Tone.PingPongDelay | null = null;
let sharedReverb: Tone.Reverb | null = null;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  masterInput = new Tone.Gain(1);
  masterVolume = new Tone.Volume(0);
  limiter = new Tone.Limiter(-0.5);
  sharedDelay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.35, wet: 1 });
  sharedReverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 1 });
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  sharedReverb.generate(); // genererar impulse response async

  // Master-summering
  masterInput.connect(masterVolume);
  masterVolume.connect(limiter);
  limiter.toDestination();

  // Delay + reverb summerar också in i master (post-limiter skulle låta reverb
  // klippa helt självt, så vi går in före limitern för att vara säkra)
  sharedDelay.connect(masterVolume);
  sharedReverb.connect(masterVolume);
}

export function getMasterInput(): Tone.InputNode {
  ensureInit();
  return masterInput!;
}

export function getDelayInput(): Tone.InputNode {
  ensureInit();
  return sharedDelay!;
}

export function getReverbInput(): Tone.InputNode {
  ensureInit();
  return sharedReverb!;
}

export function setMasterVolumeDb(db: number) {
  ensureInit();
  masterVolume!.volume.value = db;
}

/**
 * Per-spår FX-kedja. Varje spår får sin egen kedja mellan voice och master:
 *
 *   voice → dryGain ──→ master
 *        ├→ delaySend → sharedDelay
 *        ├→ reverbSend → sharedReverb
 *        └→ saturation → master (parallell distorsion)
 *
 * Mixa wet-nivåer via `setFx`. `disconnect()` stänger ner hela kedjan.
 */
export class TrackFxChain {
  private input: Tone.Gain;
  private drySend: Tone.Gain;
  private delaySend: Tone.Gain;
  private reverbSend: Tone.Gain;
  private satSend: Tone.Gain;
  private saturation: Tone.Distortion;
  private disposed = false;

  constructor(initial: TrackFx) {
    ensureInit();
    this.input = new Tone.Gain(1);
    this.drySend = new Tone.Gain(1);
    this.delaySend = new Tone.Gain(0);
    this.reverbSend = new Tone.Gain(0);
    this.satSend = new Tone.Gain(0);
    this.saturation = new Tone.Distortion({ distortion: 0.4, oversample: '2x', wet: 1 });

    // Fanout: input → alla fyra sends
    this.input.connect(this.drySend);
    this.input.connect(this.delaySend);
    this.input.connect(this.reverbSend);
    this.input.connect(this.satSend);

    // Dry + saturation (parallell) → master
    this.drySend.connect(masterInput!);
    this.satSend.connect(this.saturation);
    this.saturation.connect(masterInput!);

    // Sends → delade effekter (som i sin tur går till master)
    this.delaySend.connect(sharedDelay!);
    this.reverbSend.connect(sharedReverb!);

    this.setFx(initial);
  }

  /** Voice.connect(chain.getInput()) */
  getInput(): Tone.InputNode {
    return this.input;
  }

  setFx(fx: TrackFx) {
    if (this.disposed) return;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const d = clamp01(fx.delay);
    const r = clamp01(fx.reverb);
    const s = clamp01(fx.saturation);
    // Dry minskar något när saturation är uppe så man hör klarare effekt
    this.drySend.gain.value = 1 - s * 0.4;
    this.delaySend.gain.value = d * 0.8;
    this.reverbSend.gain.value = r * 0.9;
    this.satSend.gain.value = s;
    // Saturationens drive-mängd följer också wet
    this.saturation.distortion = 0.15 + s * 0.75;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.input.disconnect();
    this.drySend.disconnect();
    this.delaySend.disconnect();
    this.reverbSend.disconnect();
    this.satSend.disconnect();
    this.saturation.disconnect();
    this.input.dispose();
    this.drySend.dispose();
    this.delaySend.dispose();
    this.reverbSend.dispose();
    this.satSend.dispose();
    this.saturation.dispose();
  }
}

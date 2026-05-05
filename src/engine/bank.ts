import type { GateStep, Pattern, Track, TrackFx, TrackLfo } from './types';
import { emptyPattern, applyStyleToActive } from './patterns';

function migrateGate(g: GateStep): GateStep {
  return {
    ...g,
    filterLock:
      g.filterLock === undefined || g.filterLock === null ? null : Number(g.filterLock),
    velocity: typeof g.velocity === 'number' ? g.velocity : g.accent ? 1.0 : 0.8,
    nudge: typeof g.nudge === 'number' ? g.nudge : 0,
  };
}

function migrateTrack(t: Track): Track {
  const lfo: TrackLfo =
    t.lfo && typeof t.lfo === 'object'
      ? {
          target: t.lfo.target ?? 'off',
          rate: t.lfo.rate ?? '4n',
          depth: typeof t.lfo.depth === 'number' ? t.lfo.depth : 0.3,
          shape: t.lfo.shape ?? 'sine',
        }
      : { target: 'off', rate: '4n', depth: 0.3, shape: 'sine' };
  // Migrera reverb-fälten från legacy reverbShort/reverbLong till nya
  // reverbType + reverbSend. Större send "vinner" och dikterar typen:
  // long > short → hall (klassisk lång svans), annars plate.
  const fxRaw = t.fx as Partial<TrackFx> | undefined;
  let reverbType = fxRaw?.reverbType;
  let reverbSend = fxRaw?.reverbSend;
  if (reverbSend === undefined && fxRaw) {
    const legacyLong = fxRaw.reverbLong ?? fxRaw.reverb ?? 0;
    const legacyShort = fxRaw.reverbShort ?? 0;
    if (legacyShort > 0 || legacyLong > 0) {
      if (legacyShort > legacyLong) {
        reverbType = reverbType ?? 'plate';
        reverbSend = legacyShort;
      } else {
        reverbType = reverbType ?? 'hall';
        reverbSend = legacyLong;
      }
    }
  }
  const fx: TrackFx =
    fxRaw && typeof fxRaw === 'object'
      ? {
          ...fxRaw,
          delay: typeof fxRaw.delay === 'number' ? fxRaw.delay : 0,
          reverb: typeof fxRaw.reverb === 'number' ? fxRaw.reverb : 0,
          saturation: typeof fxRaw.saturation === 'number' ? fxRaw.saturation : 0,
          ...(reverbType !== undefined ? { reverbType } : {}),
          ...(reverbSend !== undefined ? { reverbSend } : {}),
        }
      : { delay: 0, reverb: 0, saturation: 0 };
  return {
    ...t,
    rotation: typeof t.rotation === 'number' ? t.rotation : 0,
    octaveShift: typeof t.octaveShift === 'number' ? t.octaveShift : 0,
    lfo,
    velocityJitter: typeof t.velocityJitter === 'number' ? t.velocityJitter : 0,
    fx,
    gateSteps: Array.isArray(t.gateSteps) ? t.gateSteps.map(migrateGate) : t.gateSteps,
  };
}

function migratePattern(p: Pattern): Pattern {
  return { ...p, tracks: p.tracks.map(migrateTrack) };
}

export type SlotId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export const SLOT_IDS: SlotId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export type Bank = {
  slots: Record<SlotId, Pattern | null>;
  activeSlot: SlotId;
  song: SlotId[];
  songMode: boolean;
  /** Master-volym i dB (–30..+6). Global, delas mellan alla slots. */
  masterDb: number;
};

const STORAGE_KEY = 'unanalog-sequencer-bank-v1';
const EXPORT_VERSION = 1;

function emptySlots(): Record<SlotId, Pattern | null> {
  return {
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
    F: null,
    G: null,
    H: null,
  };
}

export function emptyBank(): Bank {
  const slots = emptySlots();
  slots.A = applyStyleToActive(emptyPattern(), 'berlin');
  return { slots, activeSlot: 'A', song: ['A'], songMode: false, masterDb: 0 };
}

export function loadBank(): Bank | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Bank>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.slots || !parsed.activeSlot) return null;
    const slots = emptySlots();
    for (const id of SLOT_IDS) {
      const p = parsed.slots[id];
      if (p && typeof p === 'object' && Array.isArray((p as Pattern).tracks)) {
        slots[id] = migratePattern(p as Pattern);
      }
    }
    const activeSlot: SlotId = SLOT_IDS.includes(parsed.activeSlot as SlotId)
      ? (parsed.activeSlot as SlotId)
      : 'A';
    if (!slots[activeSlot]) {
      slots[activeSlot] = applyStyleToActive(emptyPattern(), 'berlin');
    }
    const song = Array.isArray(parsed.song)
      ? parsed.song.filter((s): s is SlotId => SLOT_IDS.includes(s as SlotId))
      : [activeSlot];
    const songMode = Boolean(parsed.songMode);
    const masterDb = typeof parsed.masterDb === 'number' ? parsed.masterDb : 0;
    return {
      slots,
      activeSlot,
      song: song.length > 0 ? song : [activeSlot],
      songMode,
      masterDb,
    };
  } catch {
    return null;
  }
}

export function saveBank(bank: Bank) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
  } catch {
    // ignore quota / private mode errors
  }
}

export function getActivePattern(bank: Bank): Pattern {
  const p = bank.slots[bank.activeSlot];
  if (p) return p;
  return applyStyleToActive(emptyPattern(), 'berlin');
}

export function setActivePattern(bank: Bank, pattern: Pattern): Bank {
  return {
    ...bank,
    slots: { ...bank.slots, [bank.activeSlot]: pattern },
  };
}

export function setActiveSlot(bank: Bank, id: SlotId): Bank {
  if (bank.activeSlot === id) return bank;
  const slots = { ...bank.slots };
  if (!slots[id]) {
    const source = slots[bank.activeSlot];
    slots[id] = source
      ? structuredClone(source)
      : applyStyleToActive(emptyPattern(), 'berlin');
  }
  return { ...bank, slots, activeSlot: id };
}

export function clearSlot(bank: Bank, id: SlotId): Bank {
  const slots = { ...bank.slots, [id]: null };
  let activeSlot = bank.activeSlot;
  if (id === bank.activeSlot) {
    const firstWithData = SLOT_IDS.find((s) => slots[s]);
    if (firstWithData) {
      activeSlot = firstWithData;
    } else {
      slots.A = applyStyleToActive(emptyPattern(), 'berlin');
      activeSlot = 'A';
    }
  }
  let song = bank.song.filter((s) => s !== id);
  if (song.length === 0) song = [activeSlot];
  return { ...bank, slots, activeSlot, song };
}

export function duplicateSlot(bank: Bank, from: SlotId, to: SlotId): Bank {
  const source = bank.slots[from];
  if (!source) return bank;
  const slots = { ...bank.slots, [to]: structuredClone(source) };
  return { ...bank, slots };
}

export function exportBankJson(bank: Bank): string {
  return JSON.stringify({ version: EXPORT_VERSION, bank }, null, 2);
}

export function importBankJson(text: string): Bank | null {
  try {
    const parsed = JSON.parse(text);
    const raw = parsed?.bank ?? parsed;
    if (!raw?.slots || !raw?.activeSlot) return null;
    const slots = emptySlots();
    for (const id of SLOT_IDS) {
      const p = raw.slots[id];
      if (p && typeof p === 'object' && Array.isArray(p.tracks)) {
        slots[id] = migratePattern(p as Pattern);
      }
    }
    const activeSlot: SlotId = SLOT_IDS.includes(raw.activeSlot)
      ? raw.activeSlot
      : 'A';
    if (!slots[activeSlot]) return null;
    const song = Array.isArray(raw.song)
      ? raw.song.filter((s: unknown): s is SlotId => SLOT_IDS.includes(s as SlotId))
      : [activeSlot];
    const songMode = Boolean(raw.songMode);
    const masterDb = typeof raw.masterDb === 'number' ? raw.masterDb : 0;
    return {
      slots,
      activeSlot,
      song: song.length > 0 ? song : [activeSlot],
      songMode,
      masterDb,
    };
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string): string {
  // Ta bort farliga tecken, byt mellanslag mot bindestreck, klipp till 80 tecken.
  return name
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function downloadBankFile(bank: Bank, customName?: string | null) {
  const json = exportBankJson(bank);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const clean = customName ? sanitizeFilename(customName) : '';
  const filename = clean ? `${clean}.json` : `unanalog-bank-${date}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

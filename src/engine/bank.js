import { emptyPattern, applyStyleToActive } from './patterns';
function migrateGate(g) {
    return {
        ...g,
        filterLock: g.filterLock === undefined || g.filterLock === null ? null : Number(g.filterLock),
        velocity: typeof g.velocity === 'number' ? g.velocity : g.accent ? 1.0 : 0.8,
        nudge: typeof g.nudge === 'number' ? g.nudge : 0,
    };
}
function migrateTrack(t) {
    const lfo = t.lfo && typeof t.lfo === 'object'
        ? {
            target: t.lfo.target ?? 'off',
            rate: t.lfo.rate ?? '4n',
            depth: typeof t.lfo.depth === 'number' ? t.lfo.depth : 0.3,
            shape: t.lfo.shape ?? 'sine',
        }
        : { target: 'off', rate: '4n', depth: 0.3, shape: 'sine' };
    return {
        ...t,
        rotation: typeof t.rotation === 'number' ? t.rotation : 0,
        octaveShift: typeof t.octaveShift === 'number' ? t.octaveShift : 0,
        lfo,
        velocityJitter: typeof t.velocityJitter === 'number' ? t.velocityJitter : 0,
        gateSteps: Array.isArray(t.gateSteps) ? t.gateSteps.map(migrateGate) : t.gateSteps,
    };
}
function migratePattern(p) {
    return { ...p, tracks: p.tracks.map(migrateTrack) };
}
export const SLOT_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const STORAGE_KEY = 'unanalog-sequencer-bank-v1';
const EXPORT_VERSION = 1;
function emptySlots() {
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
export function emptyBank() {
    const slots = emptySlots();
    slots.A = applyStyleToActive(emptyPattern(), 'berlin');
    return { slots, activeSlot: 'A', song: ['A'], songMode: false };
}
export function loadBank() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        if (!parsed.slots || !parsed.activeSlot)
            return null;
        const slots = emptySlots();
        for (const id of SLOT_IDS) {
            const p = parsed.slots[id];
            if (p && typeof p === 'object' && Array.isArray(p.tracks)) {
                slots[id] = migratePattern(p);
            }
        }
        const activeSlot = SLOT_IDS.includes(parsed.activeSlot)
            ? parsed.activeSlot
            : 'A';
        if (!slots[activeSlot]) {
            slots[activeSlot] = applyStyleToActive(emptyPattern(), 'berlin');
        }
        const song = Array.isArray(parsed.song)
            ? parsed.song.filter((s) => SLOT_IDS.includes(s))
            : [activeSlot];
        const songMode = Boolean(parsed.songMode);
        return { slots, activeSlot, song: song.length > 0 ? song : [activeSlot], songMode };
    }
    catch {
        return null;
    }
}
export function saveBank(bank) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
    }
    catch {
        // ignore quota / private mode errors
    }
}
export function getActivePattern(bank) {
    const p = bank.slots[bank.activeSlot];
    if (p)
        return p;
    return applyStyleToActive(emptyPattern(), 'berlin');
}
export function setActivePattern(bank, pattern) {
    return {
        ...bank,
        slots: { ...bank.slots, [bank.activeSlot]: pattern },
    };
}
export function setActiveSlot(bank, id) {
    if (bank.activeSlot === id)
        return bank;
    const slots = { ...bank.slots };
    if (!slots[id]) {
        const source = slots[bank.activeSlot];
        slots[id] = source
            ? structuredClone(source)
            : applyStyleToActive(emptyPattern(), 'berlin');
    }
    return { ...bank, slots, activeSlot: id };
}
export function clearSlot(bank, id) {
    const slots = { ...bank.slots, [id]: null };
    let activeSlot = bank.activeSlot;
    if (id === bank.activeSlot) {
        const firstWithData = SLOT_IDS.find((s) => slots[s]);
        if (firstWithData) {
            activeSlot = firstWithData;
        }
        else {
            slots.A = applyStyleToActive(emptyPattern(), 'berlin');
            activeSlot = 'A';
        }
    }
    let song = bank.song.filter((s) => s !== id);
    if (song.length === 0)
        song = [activeSlot];
    return { ...bank, slots, activeSlot, song };
}
export function duplicateSlot(bank, from, to) {
    const source = bank.slots[from];
    if (!source)
        return bank;
    const slots = { ...bank.slots, [to]: structuredClone(source) };
    return { ...bank, slots };
}
export function exportBankJson(bank) {
    return JSON.stringify({ version: EXPORT_VERSION, bank }, null, 2);
}
export function importBankJson(text) {
    try {
        const parsed = JSON.parse(text);
        const raw = parsed?.bank ?? parsed;
        if (!raw?.slots || !raw?.activeSlot)
            return null;
        const slots = emptySlots();
        for (const id of SLOT_IDS) {
            const p = raw.slots[id];
            if (p && typeof p === 'object' && Array.isArray(p.tracks)) {
                slots[id] = migratePattern(p);
            }
        }
        const activeSlot = SLOT_IDS.includes(raw.activeSlot)
            ? raw.activeSlot
            : 'A';
        if (!slots[activeSlot])
            return null;
        const song = Array.isArray(raw.song)
            ? raw.song.filter((s) => SLOT_IDS.includes(s))
            : [activeSlot];
        const songMode = Boolean(raw.songMode);
        return { slots, activeSlot, song: song.length > 0 ? song : [activeSlot], songMode };
    }
    catch {
        return null;
    }
}
function sanitizeFilename(name) {
    // Ta bort farliga tecken, byt mellanslag mot bindestreck, klipp till 80 tecken.
    return name
        .trim()
        .replace(/\.json$/i, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80);
}
export function downloadBankFile(bank, customName) {
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

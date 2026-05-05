import { useRef, useState } from 'react';
import type { Bank, SlotId } from '../engine/bank';
import { SLOT_IDS } from '../engine/bank';
import type { Track } from '../engine/types';

export type SyncMode = 'now' | 'nextBar';

export type MorphState = {
  fromSlot: SlotId;
  toSlot: SlotId;
  durationBars: number;
  progressBars: number;
};

type Props = {
  bank: Bank;
  queuedSlot: SlotId | null;
  syncMode: SyncMode;
  /** Spår i aktivt pattern — används av MIDI-export-pickern. */
  tracks: Track[];
  /** Ett ev. pågående morf-tillstånd; null = ingen morf aktiv. */
  morphState: MorphState | null;
  /** True medan WAV-export rendrar (knapp blir disablerad + visar spinner). */
  wavExporting: boolean;
  onSyncModeChange: (m: SyncMode) => void;
  onSelectSlot: (id: SlotId) => void;
  onClearSlot: (id: SlotId) => void;
  onExport: (customName: string | null) => void;
  onExportMidi: (
    bars: number,
    customName: string | null,
    trackIds?: string[],
  ) => void;
  onExportWav: (bars: number, customName: string | null) => void | Promise<void>;
  onImportFile: (file: File) => void;
  onRequestResetAll: () => void;
  onStartMorph: (from: SlotId, to: SlotId, durationBars: number) => void;
  onStopMorph: () => void;
};

export function PatternBank({
  bank,
  queuedSlot,
  syncMode,
  tracks,
  morphState,
  wavExporting,
  onSyncModeChange,
  onSelectSlot,
  onClearSlot,
  onExport,
  onExportMidi,
  onExportWav,
  onImportFile,
  onRequestResetAll,
  onStartMorph,
  onStopMorph,
}: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [exportName, setExportName] = useState('');
  const [bars, setBars] = useState<number>(4);
  // Spår-urval för MIDI-export. null = "alla" (default), Set = explicit val.
  // Vi initierar lazy så ändringar i `tracks`-prop:en inte trampar urvalet.
  const [midiTrackSel, setMidiTrackSel] = useState<Set<string> | null>(null);
  // Vilka slots användaren morfar mellan. Default A→B om båda finns.
  const slotsWithData = SLOT_IDS.filter((s) => bank.slots[s]);
  const defaultFrom = bank.activeSlot;
  const defaultTo =
    slotsWithData.find((s) => s !== defaultFrom) ?? defaultFrom;
  const [morphFrom, setMorphFrom] = useState<SlotId>(defaultFrom);
  const [morphTo, setMorphTo] = useState<SlotId>(defaultTo);
  const [morphBars, setMorphBars] = useState<number>(4);

  const toggleMidiTrack = (id: string, all: string[]) => {
    setMidiTrackSel((cur) => {
      const next = new Set(cur ?? all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Om allt är valt — gå tillbaka till "null" (= alla, neutralt läge)
      if (next.size === all.length) return null;
      // Om inget kvar — också null så användaren inte exporterar tom fil av misstag
      if (next.size === 0) return null;
      return next;
    });
  };

  const exportMidiNow = () => {
    const ids = midiTrackSel ? Array.from(midiTrackSel) : undefined;
    onExportMidi(bars, exportName.trim() || null, ids);
  };

  const exportWavNow = () => {
    void onExportWav(bars, exportName.trim() || null);
  };

  const morphActive = !!morphState;
  const morphProgress = morphState
    ? Math.min(1, morphState.progressBars / Math.max(1, morphState.durationBars))
    : 0;

  return (
    <div className="bank">
      <div className="bank__slots">
        {SLOT_IDS.map((id) => {
          const active = bank.activeSlot === id;
          const queued = queuedSlot === id;
          const hasData = !!bank.slots[id];
          const isMorphFrom = morphState?.fromSlot === id;
          const isMorphTo = morphState?.toSlot === id;
          const classes = [
            'bank__slot',
            active ? 'is-active' : '',
            queued ? 'is-queued' : '',
            hasData ? 'has-data' : 'is-empty',
            isMorphFrom ? 'is-morph-from' : '',
            isMorphTo ? 'is-morph-to' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={id} className={classes}>
              <button
                className="bank__slot-label"
                onClick={() => onSelectSlot(id)}
                title={hasData ? `Spela slot ${id}` : `Tom slot ${id} – kopiera aktuell hit`}
              >
                {id}
              </button>
              {hasData && !active && (
                <button
                  className="bank__slot-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearSlot(id);
                  }}
                  title={`Rensa slot ${id}`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="bank__sync">
        <span className="group__label">byt</span>
        <label className="field field--toggle">
          <input
            type="radio"
            name="syncmode"
            checked={syncMode === 'nextBar'}
            onChange={() => onSyncModeChange('nextBar')}
          />
          <span>nästa takt</span>
        </label>
        <label className="field field--toggle">
          <input
            type="radio"
            name="syncmode"
            checked={syncMode === 'now'}
            onChange={() => onSyncModeChange('now')}
          />
          <span>direkt</span>
        </label>
      </div>

      <div className="bank__io">
        <input
          className="bank__filename"
          type="text"
          value={exportName}
          placeholder="Filnamn (valfritt)"
          onChange={(e) => setExportName(e.target.value)}
          title="Lämna tomt för automatiskt datumnamn"
          maxLength={80}
        />
        <button
          className="chip"
          onClick={() => onExport(exportName.trim() || null)}
          title={
            exportName.trim()
              ? `Exportera hela banken som ${exportName.trim()}.json`
              : 'Exportera hela banken som JSON (datumnamn)'
          }
        >
          ⬇ JSON
        </button>
        <label className="bank__bars" title="Antal takter som renderas i export">
          <span>takter</span>
          <select value={bars} onChange={(e) => setBars(parseInt(e.target.value, 10))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </label>
        <button
          className="chip chip--midi"
          onClick={exportMidiNow}
          title={
            midiTrackSel
              ? `Exportera ${midiTrackSel.size} av ${tracks.length} spår som .mid (${bars} takter)`
              : `Exportera alla ${tracks.length} spår som .mid (${bars} takter)`
          }
        >
          🎹 MIDI
          {midiTrackSel && (
            <span className="chip__sub">
              ({midiTrackSel.size}/{tracks.length})
            </span>
          )}
        </button>
        <button
          className="chip chip--wav"
          onClick={exportWavNow}
          disabled={wavExporting}
          title={
            wavExporting
              ? 'Renderar WAV — vänta'
              : `Exportera aktiv slot som .wav (${bars} takter, full FX-kedja)`
          }
        >
          {wavExporting ? '⌛ renderar…' : '🔊 WAV'}
        </button>
        <button
          className="chip"
          onClick={() => fileInput.current?.click()}
          title="Importera bank från JSON"
        >
          ⬆ Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
        <button
          className="chip chip--danger"
          onClick={onRequestResetAll}
          title="Rensa hela banken till app-default. Bekräftas i en dialog där du också kan välja att spara JSON först."
        >
          🗑 Reset all
        </button>
      </div>

      {/* MIDI-spår-urval (collapsible) — påverkar bara MIDI-exporten */}
      <details className="bank__midi-tracks">
        <summary>
          Spår-urval till MIDI-export ·{' '}
          {midiTrackSel ? `${midiTrackSel.size}/${tracks.length}` : `alla (${tracks.length})`}
        </summary>
        <div className="bank__midi-trackgrid">
          {tracks.map((t) => {
            const checked = midiTrackSel
              ? midiTrackSel.has(t.id)
              : true;
            return (
              <label key={t.id} className="bank__midi-trackitem">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    toggleMidiTrack(
                      t.id,
                      tracks.map((x) => x.id),
                    )
                  }
                />
                <span style={{ color: t.color }}>● {t.name}</span>
                <span className="muted">ch{t.midiChannel}</span>
              </label>
            );
          })}
          <button
            className="tiny"
            onClick={() => setMidiTrackSel(null)}
            disabled={midiTrackSel === null}
            title="Återställ till alla spår"
          >
            alla
          </button>
        </div>
      </details>

      {/* Morf A→B */}
      <div className="bank__morph">
        <span className="group__label">Morf A→B</span>
        <label className="field" title="Källa-slot (start)">
          <span>från</span>
          <select
            value={morphFrom}
            onChange={(e) => setMorphFrom(e.target.value as SlotId)}
            disabled={morphActive}
          >
            {SLOT_IDS.filter((s) => bank.slots[s]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field" title="Mål-slot (slut)">
          <span>till</span>
          <select
            value={morphTo}
            onChange={(e) => setMorphTo(e.target.value as SlotId)}
            disabled={morphActive}
          >
            {SLOT_IDS.filter((s) => bank.slots[s]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field" title="Antal takter morfen ska ta">
          <span>takter</span>
          <select
            value={morphBars}
            onChange={(e) => setMorphBars(parseInt(e.target.value, 10))}
            disabled={morphActive}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </label>
        {morphActive ? (
          <button
            className="chip chip--danger"
            onClick={onStopMorph}
            title="Avbryt morf — A:s slot återställs"
          >
            ⏹ Stoppa morf
          </button>
        ) : (
          <button
            className="chip chip--morph"
            onClick={() => onStartMorph(morphFrom, morphTo, morphBars)}
            disabled={morphFrom === morphTo || !bank.slots[morphFrom] || !bank.slots[morphTo]}
            title={
              morphFrom === morphTo
                ? 'Välj olika slots för från/till'
                : `Starta crossfade ${morphFrom}→${morphTo} över ${morphBars} takter`
            }
          >
            ▶ Starta morf
          </button>
        )}
        {morphActive && (
          <div className="bank__morph-progress" title={`${Math.round(morphProgress * 100)}%`}>
            <div
              className="bank__morph-progress-bar"
              style={{ width: `${morphProgress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

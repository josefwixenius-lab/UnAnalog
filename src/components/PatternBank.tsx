import { useRef, useState } from 'react';
import type { Bank, SlotId } from '../engine/bank';
import { SLOT_IDS } from '../engine/bank';

export type SyncMode = 'now' | 'nextBar';

type Props = {
  bank: Bank;
  queuedSlot: SlotId | null;
  syncMode: SyncMode;
  onSyncModeChange: (m: SyncMode) => void;
  onSelectSlot: (id: SlotId) => void;
  onClearSlot: (id: SlotId) => void;
  onExport: (customName: string | null) => void;
  onImportFile: (file: File) => void;
};

export function PatternBank({
  bank,
  queuedSlot,
  syncMode,
  onSyncModeChange,
  onSelectSlot,
  onClearSlot,
  onExport,
  onImportFile,
}: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [exportName, setExportName] = useState('');

  return (
    <div className="bank">
      <div className="bank__slots">
        {SLOT_IDS.map((id) => {
          const active = bank.activeSlot === id;
          const queued = queuedSlot === id;
          const hasData = !!bank.slots[id];
          const classes = [
            'bank__slot',
            active ? 'is-active' : '',
            queued ? 'is-queued' : '',
            hasData ? 'has-data' : 'is-empty',
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
              ? `Exportera som ${exportName.trim()}.json`
              : 'Exportera hela banken som JSON (datumnamn)'
          }
        >
          ⬇ Export
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
      </div>
    </div>
  );
}

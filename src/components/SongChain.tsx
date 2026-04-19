import type { Bank, SlotId } from '../engine/bank';
import { SLOT_IDS } from '../engine/bank';

type Props = {
  bank: Bank;
  songIndex: number;
  onToggleMode: () => void;
  onSetStep: (index: number, slot: SlotId) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onJumpTo: (index: number) => void;
};

export function SongChain({
  bank,
  songIndex,
  onToggleMode,
  onSetStep,
  onAddStep,
  onRemoveStep,
  onJumpTo,
}: Props) {
  const available = SLOT_IDS.filter((id) => !!bank.slots[id]);
  const cycleSlot = (current: SlotId): SlotId => {
    if (available.length === 0) return current;
    const idx = available.indexOf(current);
    return available[(idx + 1) % available.length];
  };

  return (
    <div className={`song ${bank.songMode ? 'is-on' : ''}`}>
      <div className="song__head">
        <button
          className={`btn song__toggle ${bank.songMode ? 'is-on' : ''}`}
          onClick={onToggleMode}
          title="Spela kedjan takt-för-takt"
        >
          {bank.songMode ? '◼ Song mode PÅ' : '▶ Song mode AV'}
        </button>
        <span className="hint">
          {bank.songMode
            ? 'Varje ruta = en takt. Sekvensen loopar.'
            : 'Slå på för att spela din kedja istället för enbart en slot.'}
        </span>
      </div>
      <div className="song__chain">
        {bank.song.map((slot, i) => {
          const isCurrent = bank.songMode && i === songIndex;
          return (
            <div key={i} className={`song__cell ${isCurrent ? 'is-current' : ''}`}>
              <button
                className="song__slot"
                onClick={() => onSetStep(i, cycleSlot(slot))}
                title="Klicka för nästa tillgängliga slot"
              >
                {slot}
              </button>
              <span className="song__bar" title="Takt nummer">
                {i + 1}
              </span>
              <div className="song__cell-actions">
                <button
                  className="tiny"
                  onClick={() => onJumpTo(i)}
                  title="Hoppa hit (under play)"
                  disabled={!bank.songMode}
                >
                  ▸
                </button>
                {bank.song.length > 1 && (
                  <button
                    className="tiny"
                    onClick={() => onRemoveStep(i)}
                    title="Ta bort takt"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <button
          className="chip song__add"
          onClick={onAddStep}
          title="Lägg till takt i slutet"
        >
          + takt
        </button>
      </div>
    </div>
  );
}

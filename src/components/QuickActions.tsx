type Props = {
  onClearGates: () => void;
  onAllGates: () => void;
  onRandomizePitch: () => void;
  onMutate: () => void;
};

/**
 * Minimal rad med de mest använda mönsteroperationerna, placerad direkt vid
 * step-editorn så man aldrig behöver scrolla för att rensa eller slumpa.
 * Full uppsättning verktyg finns i `Tools`-panelen.
 */
export function QuickActions({ onClearGates, onAllGates, onRandomizePitch, onMutate }: Props) {
  return (
    <div className="quick-actions" role="group" aria-label="Snabbåtgärder">
      <button className="tiny" onClick={onClearGates} title="Släck alla gate-steg">
        ▢ Rensa gates
      </button>
      <button className="tiny" onClick={onAllGates} title="Tänd alla gate-steg">
        ■ Alla på
      </button>
      <button className="tiny" onClick={onRandomizePitch} title="Slumpa hela pitch-raden inom skalan">
        🎲 Slumpa toner
      </button>
      <button className="tiny" onClick={onMutate} title="Mutera ~25% av stegen (upprepa för evolution)">
        ✶ Mutera
      </button>
    </div>
  );
}

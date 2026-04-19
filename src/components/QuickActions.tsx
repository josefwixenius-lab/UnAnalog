import type { StepRowClipboard } from '../engine/patterns';

type Props = {
  onClearGates: () => void;
  onAllGates: () => void;
  onRandomizePitch: () => void;
  onMutate: () => void;
  onCopyPitch: () => void;
  onCopyGate: () => void;
  onPaste: () => void;
  clipboard: StepRowClipboard | null;
};

/**
 * Minimal rad med de mest använda mönsteroperationerna, placerad direkt vid
 * step-editorn så man aldrig behöver scrolla för att rensa eller slumpa.
 * Inkluderar copy/paste för pitch- eller gate-raden (mellan spår/slots).
 * Full uppsättning verktyg finns i `Tools`-panelen.
 */
export function QuickActions({
  onClearGates,
  onAllGates,
  onRandomizePitch,
  onMutate,
  onCopyPitch,
  onCopyGate,
  onPaste,
  clipboard,
}: Props) {
  const pasteLabel = clipboard
    ? `📥 Klistra ${clipboard.kind === 'pitch' ? 'pitch' : 'gate'}`
    : '📥 Klistra';
  const pasteTitle = clipboard
    ? `Ersätt aktivt spårs ${clipboard.kind === 'pitch' ? 'pitch' : 'gate'}-rad med kopian (${clipboard.steps.length} steg). Kortare rader loopas.`
    : 'Kopiera pitch eller gate från ett spår först';

  return (
    <div className="quick-actions" role="group" aria-label="Snabbåtgärder">
      <button className="tiny" onClick={onClearGates} title="Släck alla gate-steg på aktivt spår">
        ▢ Rensa gates
      </button>
      <button className="tiny" onClick={onAllGates} title="Tänd alla gate-steg på aktivt spår">
        ■ Alla på
      </button>
      <button className="tiny" onClick={onRandomizePitch} title="Slumpa hela pitch-raden inom skalan">
        🎲 Slumpa toner
      </button>
      <button className="tiny" onClick={onMutate} title="Mutera ~25% av stegen (upprepa för evolution)">
        ✶ Mutera
      </button>
      <span className="quick-actions__sep" aria-hidden>
        ·
      </span>
      <button
        className="tiny"
        onClick={onCopyPitch}
        title="Kopiera pitch-raden från aktivt spår — kan klistras in på ett annat spår eller en annan slot"
      >
        📋 Kopiera pitch
      </button>
      <button
        className="tiny"
        onClick={onCopyGate}
        title="Kopiera gate-raden (trigger + gate-längd + prob + ratchet + accent + villkor + p-lock + nudge)"
      >
        📋 Kopiera gate
      </button>
      <button
        className="tiny"
        onClick={onPaste}
        disabled={!clipboard}
        title={pasteTitle}
      >
        {pasteLabel}
      </button>
    </div>
  );
}

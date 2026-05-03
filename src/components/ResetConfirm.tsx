import { useEffect, useRef, useState } from 'react';

/**
 * Bekräftelsemodal för "Reset all" — rensar hela banken till default.
 *
 * Tre vägar ut:
 * - 💾 Spara JSON och rensa (säker)
 * - 🗑 Bara rensa (snabb)
 * - Avbryt (eller Esc / klick utanför)
 *
 * Filnamn-input visas så man kan ge save-filen ett kreativt namn.
 * Tom = default-filnamn (yyyy-mm-dd).
 */

type Props = {
  open: boolean;
  onClose: () => void;
  /** Spara nuvarande bank som JSON med valfritt namn, sen rensa. */
  onSaveAndReset: (customName: string | null) => void;
  /** Rensa direkt utan spara. */
  onResetOnly: () => void;
};

export function ResetConfirm({ open, onClose, onSaveAndReset, onResetOnly }: Props) {
  const [filename, setFilename] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Stäng på Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset filnamn-input när modalen öppnas på nytt
  useEffect(() => {
    if (open) setFilename('');
  }, [open]);

  if (!open) return null;

  const trimmed = filename.trim();
  const handleSave = () => {
    onSaveAndReset(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <div
      className="reset-overlay"
      role="presentation"
      onClick={(e) => {
        // Klick utanför dialog-rutan = avbryt
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="reset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title" className="reset-dialog__title">
          🗑 Rensa hela banken?
        </h2>
        <p className="reset-dialog__lead">
          Detta startar om från scratch och tar bort:
        </p>
        <ul className="reset-dialog__list">
          <li>Alla 8 slots (A–H) med pattern, tempo, skala och swing</li>
          <li>Alla spår med voices, FX, mute-grupper, spel-riktningar</li>
          <li>Song chain</li>
          <li>Hela undo-historiken</li>
        </ul>
        <p className="reset-dialog__note">
          MIDI-portval, Master-volym och step-detail-läge sparas i webbläsaren
          oberoende och påverkas inte.
        </p>

        <label className="reset-dialog__filename">
          <span>Filnamn (valfritt — annars dagens datum)</span>
          <input
            type="text"
            value={filename}
            placeholder="t.ex. nightcall-draft"
            onChange={(e) => setFilename(e.target.value)}
            autoFocus
          />
        </label>

        <div className="reset-dialog__actions">
          <button
            className="btn btn--primary"
            onClick={handleSave}
            title="Ladda ner banken som JSON-fil och rensa sedan."
          >
            💾 Spara JSON och rensa
          </button>
          <button
            className="btn btn--danger"
            onClick={onResetOnly}
            title="Rensa direkt utan att spara. Kan inte ångras."
          >
            🗑 Bara rensa
          </button>
          <button
            className="btn"
            onClick={onClose}
            title="Stäng dialogen utan att göra något (eller tryck Esc)."
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

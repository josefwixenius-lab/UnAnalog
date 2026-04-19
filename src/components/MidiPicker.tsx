import type { MidiOut } from '../engine/midi';

type Props = {
  outputs: MidiOut[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function MidiPicker({ outputs, selectedId, onSelect }: Props) {
  return (
    <div className="group">
      <label className="field">
        <span>MIDI Ut (global)</span>
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          <option value="">(ingen — tyst MIDI)</option>
          {outputs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      {outputs.length === 0 && (
        <small className="hint">
          Ingen MIDI-utgång hittad. Chrome krävs. På macOS: öppna Audio MIDI Setup → IAC-driver → aktivera.
        </small>
      )}
      {outputs.length > 0 && (
        <small className="hint">Varje spår har egen MIDI-kanal (sätts i spår-listan).</small>
      )}
    </div>
  );
}

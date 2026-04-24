import type { MidiOut } from '../engine/midi';

type Props = {
  outputs: MidiOut[];
  selectedId: string;
  onSelect: (id: string) => void;
  /**
   * Separat port för MIDI Clock (24 PPQ + Start/Stop). Att skilja clock
   * från not-porten är viktigt när du har t.ex. en trummaskin som ska synka
   * och en synt som ska ta emot noter — annars skickar sequencern
   * slumpnoter till trummaskinen också.
   */
  selectedClockId: string;
  onSelectClock: (id: string) => void;
};

export function MidiPicker({
  outputs,
  selectedId,
  onSelect,
  selectedClockId,
  onSelectClock,
}: Props) {
  const noPorts = outputs.length === 0;
  return (
    <div className="group midi-picker">
      <label className="field">
        <span>🎹 MIDI Ut — noter</span>
        <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          <option value="">(ingen — tyst MIDI)</option>
          {outputs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>⏱ Clock Ut — synk</span>
        <select value={selectedClockId} onChange={(e) => onSelectClock(e.target.value)}>
          <option value="">(ingen — ingen clock)</option>
          {outputs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      {noPorts && (
        <small className="hint">
          Ingen MIDI-utgång hittad. Chrome/Edge krävs. På macOS: öppna Audio MIDI Setup → IAC-driver → aktivera.
        </small>
      )}
      {!noPorts && (
        <small className="hint">
          Noter går till <em>MIDI Ut</em> enligt varje spårs kanal. Clock går till en
          <em> separat</em> port — praktiskt när trummaskin ska synkas men syntar får noter.
          Samma port kan användas för båda.
        </small>
      )}
    </div>
  );
}

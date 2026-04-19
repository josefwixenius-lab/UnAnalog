import type { Pattern, Track, VoiceKind } from '../engine/types';
import { VOICE_LABELS } from '../engine/voices';

type Props = {
  pattern: Pattern;
  onSelect: (id: string) => void;
  onChangeTrack: (id: string, patch: Partial<Track>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function TrackStrip({ pattern, onSelect, onChangeTrack, onAdd, onRemove }: Props) {
  return (
    <div className="trackstrip">
      {pattern.tracks.map((t) => {
        const active = t.id === pattern.activeTrackId;
        return (
          <div
            key={t.id}
            className={`trackstrip__item ${active ? 'is-active' : ''} ${!t.enabled ? 'is-muted' : ''}`}
            onClick={() => onSelect(t.id)}
            style={{ borderColor: active ? t.color : undefined }}
          >
            <span className="trackstrip__color" style={{ background: t.color }} />
            <input
              className="trackstrip__name"
              value={t.name}
              onChange={(e) => onChangeTrack(t.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <label className="trackstrip__voice" title="Intern röst">
              <span>ljud</span>
              <select
                value={t.voice}
                onChange={(e) =>
                  onChangeTrack(t.id, { voice: e.target.value as VoiceKind })
                }
                onClick={(e) => e.stopPropagation()}
              >
                {(Object.keys(VOICE_LABELS) as VoiceKind[]).map((k) => (
                  <option key={k} value={k}>
                    {VOICE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="trackstrip__vol" title="Volym (relativt röstens default)">
              <span>vol</span>
              <input
                type="range"
                min={-30}
                max={10}
                step={1}
                value={t.volumeDb}
                onChange={(e) =>
                  onChangeTrack(t.id, { volumeDb: Number(e.target.value) })
                }
                onClick={(e) => e.stopPropagation()}
              />
              <span className="unit">
                {t.volumeDb > 0 ? `+${t.volumeDb}` : t.volumeDb}
              </span>
            </label>
            <label className="trackstrip__ch" title="MIDI-kanal">
              <span>ch</span>
              <input
                type="number"
                min={1}
                max={16}
                value={t.midiChannel}
                onChange={(e) =>
                  onChangeTrack(t.id, {
                    midiChannel: Math.max(1, Math.min(16, Number(e.target.value))),
                  })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <button
              className={`tiny ${!t.enabled ? 'is-muted' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChangeTrack(t.id, { enabled: !t.enabled });
              }}
              title="Mute"
            >
              M
            </button>
            <button
              className={`tiny ${t.solo ? 'is-solo' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChangeTrack(t.id, { solo: !t.solo });
              }}
              title="Solo"
            >
              S
            </button>
            {pattern.tracks.length > 1 && (
              <button
                className="tiny"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t.id);
                }}
                title="Ta bort spår"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      {pattern.tracks.length < 8 && (
        <button className="chip trackstrip__add" onClick={onAdd} title="Lägg till spår">
          + Spår
        </button>
      )}
    </div>
  );
}

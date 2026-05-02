import type { Pattern, PlayDirection, Track, VoiceKind } from '../engine/types';
import type { MidiOut } from '../engine/midi';
import { VOICE_LABELS } from '../engine/voices';

const DIRECTION_OPTIONS: { id: PlayDirection; label: string; hint: string }[] = [
  { id: 'forward', label: '▶ Framåt', hint: 'Standardriktning — 0, 1, 2, …, len-1, 0, …' },
  { id: 'reverse', label: '◀ Bakåt', hint: 'Spelar baklänges — len-1, len-2, …, 1, 0, len-1, …' },
  { id: 'pingpong', label: '↔ Fram & tillbaka', hint: 'Studsar fram och tillbaka mellan ändarna utan att dubbla ändtonerna' },
  { id: 'random', label: '🎲 Slump', hint: 'Plockar ett random index varje step' },
  { id: 'brownian', label: '➰ Brownian', hint: 'Random walk — vandrar ±1 utan stora hopp' },
];

type Props = {
  pattern: Pattern;
  midiOuts: MidiOut[];
  globalMidiOutId: string;
  onSelect: (id: string) => void;
  onChangeTrack: (id: string, patch: Partial<Track>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function TrackStrip({
  pattern,
  midiOuts,
  globalMidiOutId,
  onSelect,
  onChangeTrack,
  onAdd,
  onRemove,
}: Props) {
  const globalName =
    midiOuts.find((m) => m.id === globalMidiOutId)?.name ?? '(ingen)';
  return (
    <div className="trackstrip">
      {pattern.tracks.map((t) => {
        const active = t.id === pattern.activeTrackId;
        return (
          <div
            key={t.id}
            className={`trackstrip__item ${active ? 'is-active' : ''} ${!t.enabled ? 'is-muted' : ''}`}
            // Auto-select vid FÖRSTA interaktion — mousedown bubblar från
            // alla sub-controls (utom där vi explicit stoppar det, t.ex.
            // trash-knappen) och fyrar innan slider/select/click-handlers.
            // → hjärnan tänker "det här spåret jobbar jag på" och Tools-
            // panelen följer med automatiskt även när man bara fippar med
            // solo/mute/voice/dir/vol/pan på ett INAKTIVT spår.
            onMouseDown={() => {
              if (!active) onSelect(t.id);
            }}
            // Behåll click-fallback för tangentbord-aktivering (Enter/Space)
            // och tillgänglighet — på vissa enheter fires inte mousedown.
            onClick={() => {
              if (!active) onSelect(t.id);
            }}
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
            <label
              className="trackstrip__dir"
              title={
                DIRECTION_OPTIONS.find((d) => d.id === (t.playDirection ?? 'forward'))?.hint ??
                'Spel-riktning per spår (SQ-10-stil)'
              }
            >
              <span>dir</span>
              <select
                value={t.playDirection ?? 'forward'}
                onChange={(e) =>
                  onChangeTrack(t.id, { playDirection: e.target.value as PlayDirection })
                }
                onClick={(e) => e.stopPropagation()}
              >
                {DIRECTION_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id} title={d.hint}>
                    {d.label}
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
            <label
              className="trackstrip__pan"
              title="Stereoposition. Dubbelklicka för att centrera (0)."
            >
              <span>pan</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={t.pan ?? 0}
                onChange={(e) =>
                  onChangeTrack(t.id, { pan: Number(e.target.value) })
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onChangeTrack(t.id, { pan: 0 });
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="unit">
                {(() => {
                  const p = t.pan ?? 0;
                  if (Math.abs(p) < 0.03) return 'C';
                  return p > 0 ? `R${Math.round(p * 100)}` : `L${Math.round(-p * 100)}`;
                })()}
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
            <label
              className="trackstrip__port"
              title={`MIDI-port för detta spår. "Global" = ${globalName}.`}
            >
              <span>port</span>
              <select
                value={t.midiOutId ?? ''}
                onChange={(e) =>
                  onChangeTrack(t.id, { midiOutId: e.target.value || undefined })
                }
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">↳ Global ({globalName})</option>
                {midiOuts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
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
                // Stoppar mousedown också så vi inte hinner selecta spåret
                // innan vi raderar det (skulle ge onödigt undo-state-trams).
                onMouseDown={(e) => e.stopPropagation()}
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

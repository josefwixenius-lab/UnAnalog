import type { MuteGroup, Pattern, PlayDirection, Track, VoiceKind } from '../engine/types';
import type { MidiOut } from '../engine/midi';
import { VOICE_LABELS } from '../engine/voices';

const DIRECTION_OPTIONS: { id: PlayDirection; label: string; hint: string }[] = [
  { id: 'forward', label: '▶ Framåt', hint: 'Standardriktning — 0, 1, 2, …, len-1, 0, …' },
  { id: 'reverse', label: '◀ Bakåt', hint: 'Spelar baklänges — len-1, len-2, …, 1, 0, len-1, …' },
  { id: 'pingpong', label: '↔ Fram & tillbaka', hint: 'Pendel utan dubbla ändtoner: 1-2-3-4-3-2-1' },
  { id: 'pingpongHold', label: '⇆ Ping-pong', hint: 'Dubbla ändtoner — accent/studs på vändpunkten: 1-2-3-4-4-3-2-1' },
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

/**
 * Spår-listan ovanför step-editorn. Två logiska rader per spår:
 *
 * - **Rad 1 (live)**: färg · namn · M · S · vol · pan · ×
 *   Det man trycker på under jam.
 * - **Rad 2 (setup)**: voice · dir · swing · ch · port · grp
 *   Sound-design och routing — sällan ändrat under jam.
 *
 * På breda skärmar (>1400px) ligger båda raderna på samma horisontella
 * linje. På smalare skärmar flippas item till column-layout så raderna
 * staplas. Alla spår beter sig lika eftersom samma media query gäller alla.
 */
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
  const globalSwing = pattern.swing;

  return (
    <div className="trackstrip">
      {pattern.tracks.map((t) => {
        const active = t.id === pattern.activeTrackId;
        const trackSwing = t.swing;
        return (
          <div
            key={t.id}
            className={`trackstrip__item ${active ? 'is-active' : ''} ${!t.enabled ? 'is-muted' : ''}`}
            // Auto-select vid FÖRSTA interaktion — mousedown bubblar från
            // alla sub-controls (utom där vi explicit stoppar det, t.ex.
            // trash-knappen) och fyrar innan slider/select/click-handlers.
            onMouseDown={() => {
              if (!active) onSelect(t.id);
            }}
            onClick={() => {
              if (!active) onSelect(t.id);
            }}
            style={{ borderColor: active ? t.color : undefined }}
          >
            {/* === Rad 1: live-kontroller (det man trycker på under jam) === */}
            <div className="trackstrip__row trackstrip__row--primary">
              <span className="trackstrip__color" style={{ background: t.color }} />
              <input
                className="trackstrip__name"
                value={t.name}
                onChange={(e) => onChangeTrack(t.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
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
              {pattern.tracks.length > 1 && (
                <button
                  className="tiny trackstrip__remove"
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

            {/* === Rad 2: setup/sound-design (sällan ändrat under jam) === */}
            <div className="trackstrip__row trackstrip__row--secondary">
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
              <label
                className="trackstrip__swing"
                title={
                  trackSwing == null
                    ? `Swing — ärver pattern.swing (${Math.round(globalSwing * 100)}%). Dubbelklicka slidern för att sätta egen, klicka unitytexten ↺ för att återgå till global.`
                    : `Swing override för detta spår: ${Math.round(trackSwing * 100)}%. Klicka ↺ för att återgå till global (${Math.round(globalSwing * 100)}%).`
                }
              >
                <span>swing</span>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.01}
                  value={trackSwing ?? globalSwing}
                  onChange={(e) =>
                    onChangeTrack(t.id, { swing: Number(e.target.value) })
                  }
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onChangeTrack(t.id, { swing: undefined });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className={`unit unit--btn ${trackSwing == null ? 'is-global' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (trackSwing != null) {
                      onChangeTrack(t.id, { swing: undefined });
                    }
                  }}
                  title={
                    trackSwing == null
                      ? 'Ärver global pattern.swing'
                      : 'Återställ till global pattern.swing'
                  }
                >
                  {trackSwing == null
                    ? `↳${Math.round(globalSwing * 100)}%`
                    : `${Math.round(trackSwing * 100)}%`}
                </button>
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
              <label
                className="trackstrip__mg"
                title="Mute-grupp. När gruppen är aktiv i Transport (A/B/C/D-knapparna) tystas detta spår med hela gruppen. Bra för live-arrangemang."
              >
                <span>grp</span>
                <select
                  value={t.muteGroup ?? ''}
                  onChange={(e) =>
                    onChangeTrack(t.id, {
                      muteGroup: (e.target.value || undefined) as MuteGroup | undefined,
                    })
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </label>
            </div>
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

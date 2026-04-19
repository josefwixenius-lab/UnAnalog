import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { VOICE_LABELS } from '../engine/voices';
export function TrackStrip({ pattern, onSelect, onChangeTrack, onAdd, onRemove }) {
    return (_jsxs("div", { className: "trackstrip", children: [pattern.tracks.map((t) => {
                const active = t.id === pattern.activeTrackId;
                return (_jsxs("div", { className: `trackstrip__item ${active ? 'is-active' : ''} ${!t.enabled ? 'is-muted' : ''}`, onClick: () => onSelect(t.id), style: { borderColor: active ? t.color : undefined }, children: [_jsx("span", { className: "trackstrip__color", style: { background: t.color } }), _jsx("input", { className: "trackstrip__name", value: t.name, onChange: (e) => onChangeTrack(t.id, { name: e.target.value }), onClick: (e) => e.stopPropagation() }), _jsxs("label", { className: "trackstrip__voice", title: "Intern r\u00F6st", children: [_jsx("span", { children: "ljud" }), _jsx("select", { value: t.voice, onChange: (e) => onChangeTrack(t.id, { voice: e.target.value }), onClick: (e) => e.stopPropagation(), children: Object.keys(VOICE_LABELS).map((k) => (_jsx("option", { value: k, children: VOICE_LABELS[k] }, k))) })] }), _jsxs("label", { className: "trackstrip__vol", title: "Volym (relativt r\u00F6stens default)", children: [_jsx("span", { children: "vol" }), _jsx("input", { type: "range", min: -30, max: 10, step: 1, value: t.volumeDb, onChange: (e) => onChangeTrack(t.id, { volumeDb: Number(e.target.value) }), onClick: (e) => e.stopPropagation() }), _jsx("span", { className: "unit", children: t.volumeDb > 0 ? `+${t.volumeDb}` : t.volumeDb })] }), _jsxs("label", { className: "trackstrip__ch", title: "MIDI-kanal", children: [_jsx("span", { children: "ch" }), _jsx("input", { type: "number", min: 1, max: 16, value: t.midiChannel, onChange: (e) => onChangeTrack(t.id, {
                                        midiChannel: Math.max(1, Math.min(16, Number(e.target.value))),
                                    }), onClick: (e) => e.stopPropagation() })] }), _jsx("button", { className: `tiny ${!t.enabled ? 'is-muted' : ''}`, onClick: (e) => {
                                e.stopPropagation();
                                onChangeTrack(t.id, { enabled: !t.enabled });
                            }, title: "Mute", children: "M" }), _jsx("button", { className: `tiny ${t.solo ? 'is-solo' : ''}`, onClick: (e) => {
                                e.stopPropagation();
                                onChangeTrack(t.id, { solo: !t.solo });
                            }, title: "Solo", children: "S" }), pattern.tracks.length > 1 && (_jsx("button", { className: "tiny", onClick: (e) => {
                                e.stopPropagation();
                                onRemove(t.id);
                            }, title: "Ta bort sp\u00E5r", children: "\u00D7" }))] }, t.id));
            }), pattern.tracks.length < 8 && (_jsx("button", { className: "chip trackstrip__add", onClick: onAdd, title: "L\u00E4gg till sp\u00E5r", children: "+ Sp\u00E5r" }))] }));
}

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export function Transport({ playing, onTogglePlay, tempo, onTempoChange, swing, onSwingChange, audible, onAudibleChange, fillActive, onFillChange, clockOut, onClockOutChange, clockOutAvailable, clockSource, onClockSourceChange, externalBpm, externalListening, externalInputAvailable, }) {
    const isExternal = clockSource === 'external';
    const displayTempo = isExternal
        ? externalBpm !== null
            ? Math.round(externalBpm)
            : null
        : tempo;
    const playLabel = isExternal
        ? externalListening
            ? '■ Sluta lyssna'
            : '▶ Lyssna'
        : playing
            ? '■ Stop'
            : '▶ Spela';
    const playActive = isExternal ? externalListening : playing;
    return (_jsxs("div", { className: "transport", children: [_jsx("button", { className: `btn btn--play ${playActive ? 'is-on' : ''} ${isExternal ? 'btn--listen' : ''}`, onClick: onTogglePlay, title: isExternal
                    ? 'Arma/avarma lyssning på extern MIDI-klocka (Start/Stop styr sen uppspelningen)'
                    : 'Starta/stoppa', children: playLabel }), _jsxs("div", { className: "segment", role: "tablist", "aria-label": "Klocka", title: "Styr tempo internt eller f\u00F6lj extern MIDI-klocka", children: [_jsx("span", { className: "segment__label", children: "Klocka" }), _jsx("button", { role: "tab", "aria-selected": !isExternal, className: `segment__btn ${!isExternal ? 'is-on' : ''}`, onClick: () => onClockSourceChange('internal'), children: "Intern" }), _jsx("button", { role: "tab", "aria-selected": isExternal, className: `segment__btn ${isExternal ? 'is-on' : ''}`, onClick: () => onClockSourceChange('external'), disabled: !externalInputAvailable && !isExternal, title: !externalInputAvailable
                            ? 'Ingen MIDI-ingång hittad — anslut en källa (t.ex. Logic + IAC-buss)'
                            : 'Följ extern MIDI-klocka (master)', children: "Extern" })] }), isExternal ? (_jsxs("div", { className: `field field--tempo-ext ${externalBpm !== null ? 'is-live' : 'is-waiting'}`, children: [_jsx("span", { children: "Tempo" }), _jsx("span", { className: "tempo-ext", children: displayTempo !== null ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: displayTempo }), _jsx("span", { className: "unit", children: "BPM" })] })) : (_jsx("em", { children: "v\u00E4ntar p\u00E5 extern klocka\u2026" })) })] })) : (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tempo" }), _jsx("input", { type: "number", min: 40, max: 220, value: tempo, onChange: (e) => onTempoChange(Number(e.target.value)) }), _jsx("span", { className: "unit", children: "BPM" })] })), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Swing" }), _jsx("input", { type: "range", min: 0, max: 0.6, step: 0.01, value: swing, onChange: (e) => onSwingChange(Number(e.target.value)) }), _jsxs("span", { className: "unit", children: [Math.round(swing * 100), "%"] })] }), _jsxs("label", { className: "field field--toggle", children: [_jsx("input", { type: "checkbox", checked: audible, onChange: (e) => onAudibleChange(e.target.checked) }), _jsx("span", { children: "Internt ljud" })] }), _jsx("button", { className: `btn btn--fill ${fillActive ? 'is-on' : ''}`, onClick: () => onFillChange(!fillActive), title: "Aktiverar steg med FILL-villkor", children: "FILL" }), !isExternal && (_jsxs("label", { className: `field field--toggle ${!clockOutAvailable ? 'is-disabled' : ''}`, title: clockOutAvailable
                    ? 'Skicka MIDI Clock (24 PPQ) + Start/Stop till vald MIDI-ut'
                    : 'Välj en MIDI-ut först', children: [_jsx("input", { type: "checkbox", checked: clockOut, disabled: !clockOutAvailable, onChange: (e) => onClockOutChange(e.target.checked) }), _jsx("span", { children: "\u23F1 Clock ut" })] }))] }));
}

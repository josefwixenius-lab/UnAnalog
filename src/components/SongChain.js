import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SLOT_IDS } from '../engine/bank';
export function SongChain({ bank, songIndex, onToggleMode, onSetStep, onAddStep, onRemoveStep, onJumpTo, }) {
    const available = SLOT_IDS.filter((id) => !!bank.slots[id]);
    const cycleSlot = (current) => {
        if (available.length === 0)
            return current;
        const idx = available.indexOf(current);
        return available[(idx + 1) % available.length];
    };
    return (_jsxs("div", { className: `song ${bank.songMode ? 'is-on' : ''}`, children: [_jsxs("div", { className: "song__head", children: [_jsx("button", { className: `btn song__toggle ${bank.songMode ? 'is-on' : ''}`, onClick: onToggleMode, title: "Spela kedjan takt-f\u00F6r-takt", children: bank.songMode ? '◼ Song mode PÅ' : '▶ Song mode AV' }), _jsx("span", { className: "hint", children: bank.songMode
                            ? 'Varje ruta = en takt. Sekvensen loopar.'
                            : 'Slå på för att spela din kedja istället för enbart en slot.' })] }), _jsxs("div", { className: "song__chain", children: [bank.song.map((slot, i) => {
                        const isCurrent = bank.songMode && i === songIndex;
                        return (_jsxs("div", { className: `song__cell ${isCurrent ? 'is-current' : ''}`, children: [_jsx("button", { className: "song__slot", onClick: () => onSetStep(i, cycleSlot(slot)), title: "Klicka f\u00F6r n\u00E4sta tillg\u00E4ngliga slot", children: slot }), _jsx("span", { className: "song__bar", title: "Takt nummer", children: i + 1 }), _jsxs("div", { className: "song__cell-actions", children: [_jsx("button", { className: "tiny", onClick: () => onJumpTo(i), title: "Hoppa hit (under play)", disabled: !bank.songMode, children: "\u25B8" }), bank.song.length > 1 && (_jsx("button", { className: "tiny", onClick: () => onRemoveStep(i), title: "Ta bort takt", children: "\u00D7" }))] })] }, i));
                    }), _jsx("button", { className: "chip song__add", onClick: onAddStep, title: "L\u00E4gg till takt i slutet", children: "+ takt" })] })] }));
}

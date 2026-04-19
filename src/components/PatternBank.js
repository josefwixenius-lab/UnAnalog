import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { SLOT_IDS } from '../engine/bank';
export function PatternBank({ bank, queuedSlot, syncMode, onSyncModeChange, onSelectSlot, onClearSlot, onExport, onImportFile, }) {
    const fileInput = useRef(null);
    const [exportName, setExportName] = useState('');
    return (_jsxs("div", { className: "bank", children: [_jsx("div", { className: "bank__slots", children: SLOT_IDS.map((id) => {
                    const active = bank.activeSlot === id;
                    const queued = queuedSlot === id;
                    const hasData = !!bank.slots[id];
                    const classes = [
                        'bank__slot',
                        active ? 'is-active' : '',
                        queued ? 'is-queued' : '',
                        hasData ? 'has-data' : 'is-empty',
                    ]
                        .filter(Boolean)
                        .join(' ');
                    return (_jsxs("div", { className: classes, children: [_jsx("button", { className: "bank__slot-label", onClick: () => onSelectSlot(id), title: hasData ? `Spela slot ${id}` : `Tom slot ${id} – kopiera aktuell hit`, children: id }), hasData && !active && (_jsx("button", { className: "bank__slot-clear", onClick: (e) => {
                                    e.stopPropagation();
                                    onClearSlot(id);
                                }, title: `Rensa slot ${id}`, children: "\u00D7" }))] }, id));
                }) }), _jsxs("div", { className: "bank__sync", children: [_jsx("span", { className: "group__label", children: "byt" }), _jsxs("label", { className: "field field--toggle", children: [_jsx("input", { type: "radio", name: "syncmode", checked: syncMode === 'nextBar', onChange: () => onSyncModeChange('nextBar') }), _jsx("span", { children: "n\u00E4sta takt" })] }), _jsxs("label", { className: "field field--toggle", children: [_jsx("input", { type: "radio", name: "syncmode", checked: syncMode === 'now', onChange: () => onSyncModeChange('now') }), _jsx("span", { children: "direkt" })] })] }), _jsxs("div", { className: "bank__io", children: [_jsx("input", { className: "bank__filename", type: "text", value: exportName, placeholder: "Filnamn (valfritt)", onChange: (e) => setExportName(e.target.value), title: "L\u00E4mna tomt f\u00F6r automatiskt datumnamn", maxLength: 80 }), _jsx("button", { className: "chip", onClick: () => onExport(exportName.trim() || null), title: exportName.trim()
                            ? `Exportera som ${exportName.trim()}.json`
                            : 'Exportera hela banken som JSON (datumnamn)', children: "\u2B07 Export" }), _jsx("button", { className: "chip", onClick: () => fileInput.current?.click(), title: "Importera bank fr\u00E5n JSON", children: "\u2B06 Import" }), _jsx("input", { ref: fileInput, type: "file", accept: "application/json,.json", style: { display: 'none' }, onChange: (e) => {
                            const file = e.target.files?.[0];
                            if (file)
                                onImportFile(file);
                            e.target.value = '';
                        } })] })] }));
}

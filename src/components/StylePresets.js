import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STYLES = [
    { id: 'ambient', label: 'Ambient', hint: 'gles, drömsk — trivs i pentatonisk moll runt 80 BPM' },
    { id: 'acid', label: 'Acid', hint: 'slides & ratchets — trivs i frygisk runt 128 BPM' },
    { id: 'berlin', label: 'Berlin', hint: 'tät & pulsande — trivs i moll runt 115 BPM' },
    { id: 'idm', label: 'IDM', hint: 'euklidisk & polyrytmisk — trivs i dorisk runt 140 BPM' },
    { id: 'chillout', label: 'Chillout', hint: 'mjukt swing — trivs i pentatonisk dur runt 95 BPM' },
];
export function StylePresets({ onApply }) {
    return (_jsxs("div", { className: "group", children: [_jsx("span", { className: "group__label", children: "Stilpresets \u2014 skriver \u00F6ver aktivt sp\u00E5r, r\u00F6r inte tempo/skala" }), _jsx("div", { className: "chips", children: STYLES.map((s) => (_jsx("button", { className: "chip", title: s.hint, onClick: () => onApply(s.id), children: s.label }, s.id))) })] }));
}

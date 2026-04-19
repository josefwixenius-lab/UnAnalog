import { useRef, useState } from 'react';
import {
  parseMidiFile,
  type ImportedFile,
  type ImportedTrack,
  type QuantResolution,
} from '../engine/midiImport';

type Props = {
  activeTrackName: string;
  onImport: (file: ImportedFile, track: ImportedTrack, quant: QuantResolution) => void;
};

const QUANTS: { id: QuantResolution; label: string; hint: string }[] = [
  { id: '16n', label: '1/16', hint: 'finast — fångar alla detaljer' },
  { id: '8n', label: '1/8', hint: 'medium — bra för melodier' },
  { id: '4n', label: '1/4', hint: 'grov — bara huvudslag' },
];

export function MidiImport({ activeTrackName, onImport }: Props) {
  const [parsed, setParsed] = useState<ImportedFile | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [quant, setQuant] = useState<QuantResolution>('16n');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const f = await parseMidiFile(file);
      if (f.tracks.length === 0) {
        setError('Ingen not-data i filen.');
        setParsed(null);
        return;
      }
      setParsed(f);
      setSelected(f.tracks[0].index);
    } catch (e) {
      setError('Kunde inte läsa filen – är det en MIDI-fil?');
      setParsed(null);
    }
  };

  const applyImport = () => {
    if (!parsed || selected == null) return;
    const trk = parsed.tracks.find((t) => t.index === selected);
    if (!trk) return;
    onImport(parsed, trk, quant);
  };

  const reset = () => {
    setParsed(null);
    setSelected(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="midi-import group--tools">
      <span className="group__label">MIDI-filimport → {activeTrackName}</span>

      {!parsed && (
        <div className="field-row">
          <label className="btn">
            📂 Välj .mid / .midi
            <input
              ref={fileRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          {error && <span className="hint hint--warn">{error}</span>}
          <span className="hint">
            Filen kvantiseras till steg, toner snappas till valda skalan, samtidiga toner staplas.
          </span>
        </div>
      )}

      {parsed && (
        <>
          <div className="field-row">
            <span className="hint">
              <strong>{parsed.name}</strong> · {parsed.bpm.toFixed(0)} BPM ·{' '}
              {parsed.durationSec.toFixed(1)} s · {parsed.tracks.length} spår
            </span>
            <button className="chip" onClick={reset}>
              ⟲ Byt fil
            </button>
          </div>

          <div className="field-row">
            <span className="group__label">Spår i filen</span>
            <div className="midi-import__tracks">
              {parsed.tracks.map((t) => (
                <button
                  key={t.index}
                  className={`chip ${selected === t.index ? 'is-on' : ''}`}
                  onClick={() => setSelected(t.index)}
                  title={`Kanal ${t.channel + 1} · ${t.noteCount} noter · ${t.durationSec.toFixed(1)} s`}
                >
                  {t.name} · {t.noteCount}n
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <span className="group__label">Kvantisering</span>
            {QUANTS.map((q) => (
              <button
                key={q.id}
                className={`chip ${quant === q.id ? 'is-on' : ''}`}
                onClick={() => setQuant(q.id)}
                title={q.hint}
              >
                {q.label}
              </button>
            ))}
            <button className="btn btn--primary" onClick={applyImport} disabled={selected == null}>
              ⇣ Importera till {activeTrackName}
            </button>
          </div>

          <div className="field-row">
            <span className="hint">
              Tips: importen skriver över både pitch- och gate-spåret på aktivt spår. BPM och skala
              rörs inte.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

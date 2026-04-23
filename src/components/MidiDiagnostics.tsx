import { useEffect, useRef, useState } from 'react';
import {
  refreshMidiPorts,
  sendClockTestBurst,
  sendTestNote,
  tapMidiInputs,
  tapMidiSend,
} from '../engine/midi';
import type { MidiIn, MidiOut } from '../engine/midi';

/**
 * Diagnostikpanel för MIDI-synk. Visar:
 *  - Alla hittade in- och ut-portar med state + connection-indikator
 *  - Live-LED när vi skickar clock, start, stop, note ut
 *  - Live-LED när vi tar emot clock, start, stop eller noter in
 *  - Senaste mottagna meddelandet (för att se t.ex. 0xFA Start från master)
 *  - Test-knappar: skicka testnot, skicka 1-takts clock-burst, refresh ports
 *
 * Tanken är att du ska kunna identifiera exakt var synken bryter:
 *   · Syns inte din trummaskin alls? → port-problem (drivrutin / USB / Chrome)
 *   · Syns porten men blinkar inte OUT-LED? → sändningsfel i koden
 *   · Blinkar OUT men trumman följer inte? → trumman tar inte emot Sync In
 *   · Är i slave-läge men INGEN IN-LED? → trumman skickar inte clock
 *   · Blinkar IN men tempo-rutan är tom? → <24 pulser, häng kvar en stund
 */

type Props = {
  inputs: MidiIn[];
  outputs: MidiOut[];
  selectedOutId: string;
  defaultChannel?: number;
};

type Blink = { ts: number; kind: string };

export function MidiDiagnostics({ inputs, outputs, selectedOutId, defaultChannel = 1 }: Props) {
  const [outBlink, setOutBlink] = useState<Map<string, Blink>>(new Map());
  const [inBlink, setInBlink] = useState<Map<string, Blink>>(new Map());
  const [lastRecv, setLastRecv] = useState<string>('—');
  const [lastRecvPortId, setLastRecvPortId] = useState<string>('');
  const [testChannel, setTestChannel] = useState<number>(defaultChannel);
  const [testBpm, setTestBpm] = useState<number>(120);
  const tickRef = useRef<number | null>(null);

  // Tick var 80 ms för att "släcka" LEDs mjukt utan att spamma re-renders för
  // mycket. När inget händer hoppar vi av loopen.
  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      setOutBlink((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) {
          if (now - v.ts > 400) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setInBlink((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) {
          if (now - v.ts > 400) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      tickRef.current = window.setTimeout(loop, 80);
    };
    tickRef.current = window.setTimeout(loop, 80);
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, []);

  // Lyssna på send-sidan
  useEffect(() => {
    const off = tapMidiSend((e) => {
      setOutBlink((prev) => {
        const next = new Map(prev);
        const key = `${e.outId}:${e.type}`;
        next.set(key, { ts: performance.now(), kind: e.type });
        return next;
      });
    });
    return off;
  }, []);

  // Lyssna på alla inkommande MIDI-meddelanden
  useEffect(() => {
    if (inputs.length === 0) return;
    const off = tapMidiInputs(
      inputs.map((m) => m.port),
      (m) => {
        const status = m.status;
        let kind = 'data';
        if (status === 0xf8) kind = 'clock';
        else if (status === 0xfa) kind = 'start';
        else if (status === 0xfb) kind = 'continue';
        else if (status === 0xfc) kind = 'stop';
        else if ((status & 0xf0) === 0x90) kind = 'note';
        else if ((status & 0xf0) === 0x80) kind = 'off';
        else if ((status & 0xf0) === 0xb0) kind = 'cc';

        setInBlink((prev) => {
          const next = new Map(prev);
          next.set(`${m.portId}:${kind}`, { ts: performance.now(), kind });
          return next;
        });
        // Skriv alltid ut senaste meddelandet utom rena clock-pulser (annars
        // får man aldrig se något annat när en master är igång).
        if (kind !== 'clock') {
          const hex = Array.from(m.data)
            .slice(0, 3)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(' ');
          setLastRecv(`${kind.toUpperCase()}  [${hex}]  ← ${m.portName}`);
          setLastRecvPortId(m.portId);
        }
      },
    );
    return off;
  }, [inputs]);

  const selectedOut = outputs.find((o) => o.id === selectedOutId) ?? null;

  const onTestNote = () => {
    if (!selectedOut) return;
    sendTestNote(selectedOut.port, testChannel, 60, 250);
  };

  const onTestClock = () => {
    if (!selectedOut) return;
    sendClockTestBurst(selectedOut.port, testBpm, 1);
  };

  const onRefresh = () => {
    void refreshMidiPorts();
  };

  return (
    <div className="diag">
      <div className="diag__row diag__row--tools">
        <button type="button" className="btn" onClick={onRefresh} title="Läs om port-listan">
          ⟳ Uppdatera portar
        </button>

        <div className="diag__sep" />

        <label className="diag__field">
          <span>Test-kanal</span>
          <select
            value={testChannel}
            onChange={(e) => setTestChannel(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn"
          onClick={onTestNote}
          disabled={!selectedOut}
          title="Skicka Note-On/Off (C4) till vald utgång"
        >
          🎵 Skicka testnot
        </button>

        <label className="diag__field">
          <span>Test-BPM</span>
          <input
            type="number"
            min={40}
            max={240}
            step={1}
            value={testBpm}
            onChange={(e) => setTestBpm(Math.max(40, Math.min(240, parseInt(e.target.value, 10) || 120)))}
          />
        </label>

        <button
          type="button"
          className="btn"
          onClick={onTestClock}
          disabled={!selectedOut}
          title="Skicka Start → 96 clock-pulser (en takt @ 4/4) → Stop"
        >
          ⏱ 1 takt testclock
        </button>
      </div>

      <div className="diag__grid">
        <div className="diag__panel">
          <h4 className="diag__title">MIDI Ut</h4>
          {outputs.length === 0 ? (
            <p className="diag__empty">
              Ingen MIDI-utgång hittad. Kontrollera att enheten är ansluten och att Chrome/Edge har
              MIDI-behörighet (lås-ikon i adressfältet).
            </p>
          ) : (
            <ul className="diag__ports">
              {outputs.map((o) => {
                const isSel = o.id === selectedOutId;
                const clock = outBlink.get(`${o.id}:clock`);
                const start = outBlink.get(`${o.id}:start`);
                const stop = outBlink.get(`${o.id}:stop`);
                const note = outBlink.get(`${o.id}:note`);
                return (
                  <li
                    key={o.id}
                    className={`diag__port${isSel ? ' diag__port--selected' : ''}`}
                  >
                    <div className="diag__portHead">
                      <span
                        className={`diag__state diag__state--${o.state}`}
                        title={`state: ${o.state} · connection: ${o.connection}`}
                      />
                      <span className="diag__portName">{o.name}</span>
                      {o.manufacturer && <span className="diag__mfg">{o.manufacturer}</span>}
                    </div>
                    <div className="diag__leds">
                      <Led label="CLK" active={!!clock} color="#6ee7b7" />
                      <Led label="START" active={!!start} color="#fbbf24" />
                      <Led label="STOP" active={!!stop} color="#fb7185" />
                      <Led label="NOTE" active={!!note} color="#a78bfa" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="diag__panel">
          <h4 className="diag__title">MIDI In</h4>
          {inputs.length === 0 ? (
            <p className="diag__empty">
              Ingen MIDI-ingång hittad. För clock-slave: anslut trummaskinen som master och
              aktivera Clock Out på den. För keyboardinput: se att din keyboards USB-MIDI är
              aktiverad.
            </p>
          ) : (
            <ul className="diag__ports">
              {inputs.map((i) => {
                const clock = inBlink.get(`${i.id}:clock`);
                const start = inBlink.get(`${i.id}:start`);
                const stop = inBlink.get(`${i.id}:stop`);
                const note = inBlink.get(`${i.id}:note`);
                const cc = inBlink.get(`${i.id}:cc`);
                return (
                  <li key={i.id} className="diag__port">
                    <div className="diag__portHead">
                      <span
                        className={`diag__state diag__state--${i.state}`}
                        title={`state: ${i.state} · connection: ${i.connection}`}
                      />
                      <span className="diag__portName">{i.name}</span>
                      {i.manufacturer && <span className="diag__mfg">{i.manufacturer}</span>}
                    </div>
                    <div className="diag__leds">
                      <Led label="CLK" active={!!clock} color="#6ee7b7" />
                      <Led label="START" active={!!start} color="#fbbf24" />
                      <Led label="STOP" active={!!stop} color="#fb7185" />
                      <Led label="NOTE" active={!!note} color="#a78bfa" />
                      <Led label="CC" active={!!cc} color="#60a5fa" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="diag__last">
        <span className="diag__lastLabel">Senaste mottagna:</span>
        <code className={`diag__lastMsg${lastRecvPortId ? ' diag__lastMsg--hit' : ''}`}>
          {lastRecv}
        </code>
      </div>

      <details className="diag__help">
        <summary>Felsökningstips för trummaskin</summary>
        <ol>
          <li>
            <strong>Har enheten en egen Sync-inställning?</strong> På Behringer LMDrum: Menu →
            System/Settings → <em>Sync = MIDI</em> (för slave) eller <em>MIDI Clock Out = ON</em>{' '}
            (för master).
          </li>
          <li>
            <strong>Syns porten alls?</strong> Om ingen utgång visas, dra ur och in USB-kabeln och
            tryck <em>Uppdatera portar</em>. På macOS: prova även Audio MIDI Setup → Show MIDI
            Studio och se att enheten är där.
          </li>
          <li>
            <strong>Testa med testnot.</strong> Om testnot ger ljud men clock inte funkar, är det
            klocksynken (ofta på trummans sida) som behöver aktiveras.
          </li>
          <li>
            <strong>Testa 1-takts testclock.</strong> Trumman ska gå exakt 4 kvartsnoter sen
            stanna. Om den går fel tempo har den en egen divider/multiplier (kontrollera
            Clock In Ratio).
          </li>
          <li>
            <strong>Slave-läge:</strong> När UnAnalog är slave, se till att (a) Clock-källa =
            Extern, (b) Play-knappen är armad, (c) CLK-LED blinkar på rätt port i listan ovan när
            trumman spelar.
          </li>
        </ol>
      </details>
    </div>
  );
}

function Led({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <span className={`led${active ? ' led--on' : ''}`} title={label}>
      <span
        className="led__dot"
        style={{
          background: active ? color : undefined,
          boxShadow: active ? `0 0 8px ${color}, 0 0 2px ${color}` : undefined,
        }}
      />
      <span className="led__label">{label}</span>
    </span>
  );
}

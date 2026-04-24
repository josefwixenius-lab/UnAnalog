type ClockSource = 'internal' | 'external';

type Props = {
  playing: boolean;
  onTogglePlay: () => void;
  tempo: number;
  onTempoChange: (v: number) => void;
  swing: number;
  onSwingChange: (v: number) => void;
  audible: boolean;
  onAudibleChange: (v: boolean) => void;
  fillActive: boolean;
  onFillChange: (v: boolean) => void;
  clockOut: boolean;
  onClockOutChange: (v: boolean) => void;
  clockOutAvailable: boolean;
  /** Inspelningsläge: armed = väntar på nästa takt, recording = skriver aktivt */
  recordArmed: boolean;
  recording: boolean;
  recordAvailable: boolean;
  onToggleRecord: () => void;
  clockSource: ClockSource;
  onClockSourceChange: (src: ClockSource) => void;
  externalBpm: number | null;
  externalListening: boolean;
  externalInputAvailable: boolean;
  masterDb: number;
  onMasterDbChange: (v: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function Transport({
  playing,
  onTogglePlay,
  tempo,
  onTempoChange,
  swing,
  onSwingChange,
  audible,
  onAudibleChange,
  fillActive,
  onFillChange,
  clockOut,
  onClockOutChange,
  clockOutAvailable,
  recordArmed,
  recording,
  recordAvailable,
  onToggleRecord,
  clockSource,
  onClockSourceChange,
  externalBpm,
  externalListening,
  externalInputAvailable,
  masterDb,
  onMasterDbChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
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

  return (
    <div className="transport">
      <button
        className={`btn btn--play ${playActive ? 'is-on' : ''} ${isExternal ? 'btn--listen' : ''}`}
        onClick={onTogglePlay}
        title={
          isExternal
            ? 'Arma/avarma lyssning på extern MIDI-klocka (Start/Stop styr sen uppspelningen)'
            : 'Starta/stoppa'
        }
      >
        {playLabel}
      </button>

      <button
        className={`btn btn--rec ${recording ? 'is-recording' : recordArmed ? 'is-armed' : ''}`}
        onClick={onToggleRecord}
        disabled={!recordAvailable}
        title={
          !recordAvailable
            ? 'Välj en MIDI-ingång först (konfigureras automatiskt när din keyboard är inkopplad).'
            : recording
              ? 'Stoppa inspelning'
              : recordArmed
                ? 'Avarma — spelar inte in nästa takt'
                : 'Arma inspelning — börjar vid nästa takt. Spela in noter från MIDI-ingång rakt in i aktivt spår.'
        }
      >
        <span className="btn__rec-dot" aria-hidden="true" />
        {recording ? 'Rec' : recordArmed ? 'Arm' : 'Rec'}
      </button>

      <div
        className="segment"
        role="tablist"
        aria-label="Klocka"
        title="Styr tempo internt eller följ extern MIDI-klocka"
      >
        <span className="segment__label">Klocka</span>
        <button
          role="tab"
          aria-selected={!isExternal}
          className={`segment__btn ${!isExternal ? 'is-on' : ''}`}
          onClick={() => onClockSourceChange('internal')}
        >
          Intern
        </button>
        <button
          role="tab"
          aria-selected={isExternal}
          className={`segment__btn ${isExternal ? 'is-on' : ''}`}
          onClick={() => onClockSourceChange('external')}
          disabled={!externalInputAvailable && !isExternal}
          title={
            !externalInputAvailable
              ? 'Ingen MIDI-ingång hittad — anslut en källa (t.ex. Logic + IAC-buss)'
              : 'Följ extern MIDI-klocka (master)'
          }
        >
          Extern
        </button>
      </div>

      {isExternal ? (
        <div className={`field field--tempo-ext ${externalBpm !== null ? 'is-live' : 'is-waiting'}`}>
          <span>Tempo</span>
          <span className="tempo-ext">
            {displayTempo !== null ? (
              <>
                <strong>{displayTempo}</strong>
                <span className="unit">BPM</span>
              </>
            ) : (
              <em>väntar på extern klocka…</em>
            )}
          </span>
        </div>
      ) : (
        <label className="field">
          <span>Tempo</span>
          <input
            type="number"
            min={40}
            max={220}
            value={tempo}
            onChange={(e) => onTempoChange(Number(e.target.value))}
          />
          <span className="unit">BPM</span>
        </label>
      )}

      <label className="field">
        <span>Swing</span>
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.01}
          value={swing}
          onChange={(e) => onSwingChange(Number(e.target.value))}
        />
        <span className="unit">{Math.round(swing * 100)}%</span>
      </label>

      <label className="field field--toggle">
        <input
          type="checkbox"
          checked={audible}
          onChange={(e) => onAudibleChange(e.target.checked)}
        />
        <span>Internt ljud</span>
      </label>

      <button
        className={`btn btn--fill ${fillActive ? 'is-on' : ''}`}
        onClick={() => onFillChange(!fillActive)}
        title="Aktiverar steg med FILL-villkor"
      >
        FILL
      </button>

      {!isExternal && (
        <label
          className={`field field--toggle ${!clockOutAvailable ? 'is-disabled' : ''}`}
          title={
            clockOutAvailable
              ? 'Skicka MIDI Clock (24 PPQ) + Start/Stop till vald Clock-port'
              : 'Välj en Clock-port i MIDI-rutan först'
          }
        >
          <input
            type="checkbox"
            checked={clockOut}
            disabled={!clockOutAvailable}
            onChange={(e) => onClockOutChange(e.target.checked)}
          />
          <span>⏱ Clock ut</span>
        </label>
      )}

      <label className="field field--master" title="Master-volym i dB — en mjuk brickwall-limiter ligger efter så det aldrig clippar även när du drar upp.">
        <span>Master</span>
        <input
          type="range"
          min={-30}
          max={6}
          step={1}
          value={masterDb}
          onChange={(e) => onMasterDbChange(Number(e.target.value))}
        />
        <span className="unit">
          {masterDb > 0 ? `+${masterDb}` : masterDb} dB
        </span>
      </label>

      <div className="undo-group" role="group" aria-label="Ångra/gör om">
        <button
          className="btn btn--undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Ångra (Cmd/Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="btn btn--redo"
          onClick={onRedo}
          disabled={!canRedo}
          title="Gör om (Cmd/Ctrl+Shift+Z)"
        >
          ↷
        </button>
      </div>
    </div>
  );
}

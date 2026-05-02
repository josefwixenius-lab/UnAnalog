import { useEffect, useRef, type ReactNode } from 'react';
import { APP_META } from '../meta';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: 'start', title: '1. Snabbstart — första ljudet på 30 sek' },
  { id: 'shortcuts', title: '2. Tangent-shortcuts & undo/redo' },
  { id: 'transport', title: '3. Transport: play, tempo, swing, master, FILL' },
  { id: 'key', title: '4. Tonart, skala och baseoktav' },
  { id: 'tracks', title: '5. Spår: voices, mute/solo, volym, kanal' },
  { id: 'pitch', title: '6. Pitch-spåret: toner, oktaver, ackord, glid' },
  { id: 'gate', title: '7. Gate-spåret: rytmen och alla per-steg-parametrar' },
  { id: 'stepview', title: '8. Step-editor: kompakt vs detaljerat läge' },
  { id: 'tools', title: '9. Verktyg: längder, filter, sidechain, LFO, FX-djup' },
  { id: 'quick', title: '10. Snabbåtgärder & copy/paste av rader' },
  { id: 'styles', title: '11. Stilpresets + 🎲 Slumpa nytt pattern' },
  { id: 'chord', title: '12. Ackord-input, sekvensinspelning & loop-rec' },
  { id: 'midi-import', title: '13. MIDI-import' },
  { id: 'bank', title: '14. Pattern bank: spara, ladda, exportera' },
  { id: 'song', title: '15. Song chain — kedja patterns' },
  { id: 'midi-out', title: '16. MIDI ut — styra DAW/hårdvara' },
  { id: 'clock', title: '17. MIDI Clock in/ut — synka med annan utrustning' },
  { id: 'diag', title: '18. 🔧 MIDI-diagnostik — felsök synk & portar' },
  { id: 'tips', title: '19. Tips, idéer och felsökning' },
  { id: 'credits', title: '20. Credits & copyright' },
];

export function Manual({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Scrolla till toppen när manualen öppnas
    dialogRef.current?.scrollTo({ top: 0 });
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="manual-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="manual"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="manual__header">
          <div>
            <h1>{APP_META.name} — manual</h1>
            <small>Version {APP_META.version} · © {APP_META.year} {APP_META.owner}</small>
          </div>
          <button className="manual__close" onClick={onClose} aria-label="Stäng manualen">
            ×
          </button>
        </header>

        <nav className="manual__toc" aria-label="Innehållsförteckning">
          <strong>Innehåll</strong>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#man-${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="manual__body">
          <p className="manual__intro">
            Välkommen! Det här är en steg-sequencer inspirerad av Elektron-tänkandet:
            varje spår består av ett <em>pitch-spår</em> (vilka toner) och ett{' '}
            <em>gate-spår</em> (när och hur de spelas). Spåren kan ha olika längd, vilket ger
            polymeter och levande mönster utan extra jobb. Allt sparas automatiskt i
            webbläsaren.
          </p>

          <TipBox>
            <strong>UI-översikt:</strong> gränssnittet är uppdelat i två zoner.
            {' '}<em style={{ color: 'var(--accent)' }}>🌍 Global</em> (övre halvan) påverkar
            hela låten: tempo, tonart, pattern-bank, song chain. <em style={{ color: 'var(--accent-2)' }}>🎛 Aktivt spår</em>
            {' '}(nedre halvan) visar allt som bara gäller det spår du valt. När du klickar ett
            annat spår byter hela den gula zonen fokus.
          </TipBox>

          <TipBox>
            Klicka bara runt! Allt går att ångra med <kbd>Cmd/Ctrl+Z</kbd> (eller ↶-knappen
            uppe i transporten). Upp till 60 steg bakåt. Se §2 för alla genvägar.
          </TipBox>

          {/* === 1. SNABBSTART === */}
          <section id="man-start">
            <h2>1. Snabbstart — första ljudet på 30 sek</h2>
            <ol>
              <li>
                Tryck <kbd>▶ Spela</kbd> uppe till vänster. Första gången behöver webbläsaren
                ett klick för att starta ljudet — det är det klicket som räknas.
              </li>
              <li>
                I toppmenyn: välj <em>Tonart</em> (t.ex. "A") och <em>Skala</em> (t.ex.
                "Minor pentatonic"). Allt du spelar håller sig nu i tonarten.
              </li>
              <li>
                Klicka på <strong>Stilar</strong> och välj en preset, t.ex. "House". Du hör
                omedelbart en bas/kick/hihat-loop.
              </li>
              <li>
                I <strong>Spår</strong>-listan, klicka på "Bass", "Lead" osv. för att se
                respektive spår i pitch- och gate-vyn under.
              </li>
              <li>
                Klicka på tonerna i <strong>Pitch</strong>-raden och gate-rutorna i{' '}
                <strong>Gate</strong>-raden för att ändra mönstret.
              </li>
            </ol>
            <Example>
              Prova: välj skala "Minor pentatonic", klicka på Lead-spåret, tryck "Slumpa
              toner" i Verktyg, och lyssna. Gillar du inte? "Mutera 25%" gör små variationer.
            </Example>
          </section>

          {/* === 2. SHORTCUTS === */}
          <section id="man-shortcuts">
            <h2>2. Tangent-shortcuts & undo/redo</h2>
            <p>
              När du jammar vill du ha händerna på tangentbordet, inte på musen. UnAnalog
              lyssnar på följande tangenter <em>när fokus inte ligger i ett textfält</em>
              {' '}(skriver du t.ex. tempo tar fältet hand om sina egna tangenter).
            </p>
            <dl>
              <dt><kbd>Space</kbd></dt>
              <dd>Play / Stop. I externt klock-läge armar/avarmar det istället lyssnaren.</dd>
              <dt><kbd>1</kbd> – <kbd>8</kbd></dt>
              <dd>Byt till pattern-slot A–H. Följer aktivt sync-läge (genast / nästa takt).</dd>
              <dt><kbd>Z</kbd> / <kbd>X</kbd></dt>
              <dd>Byt aktivt spår bakåt / framåt. Zonen "🎛 Aktivt spår" följer med direkt.</dd>
              <dt><kbd>Q</kbd></dt>
              <dd>Mute-toggle på aktivt spår (lika med M-knappen i spår-listan).</dd>
              <dt><kbd>W</kbd></dt>
              <dd>Solo-toggle på aktivt spår.</dd>
              <dt><kbd>Cmd/Ctrl + Z</kbd></dt>
              <dd>Ångra senaste ändring. Historik på upp till 60 steg bakåt.</dd>
              <dt><kbd>Cmd/Ctrl + Shift + Z</kbd> eller <kbd>Cmd/Ctrl + Y</kbd></dt>
              <dd>Gör om (redo).</dd>
              <dt><kbd>Esc</kbd></dt>
              <dd>Stänger manualen (just den här rutan).</dd>
            </dl>
            <TipBox>
              Undo loggar bara <em>dina</em> ändringar — inte engine-automatik som t.ex.
              automatiskt slot-byte via song mode. Importerar du en bank nollställs
              historiken så du inte råkar "ångra" dig tillbaka till den gamla banken.
            </TipBox>
            <Example>
              Jamma live: <kbd>X</kbd> byter till lead-spåret, <kbd>W</kbd> solo:ar det
              för att höra soundet rent, <kbd>W</kbd> igen släpper solot. <kbd>2</kbd> byter
              till slot B för refrängen vid nästa takt. <kbd>Space</kbd> stoppar allt.
            </Example>
          </section>

          {/* === 3. TRANSPORT === */}
          <section id="man-transport">
            <h2>3. Transport: play, tempo, swing, master, FILL</h2>
            <p>Allt som styr själva uppspelningen sitter överst.</p>
            <dl>
              <dt>▶ Spela / ■ Stop</dt>
              <dd>Startar/stoppar Transporten. Kortkommando: ingen tangent — klicket krävs för
                att låsa upp ljudet i webbläsaren.</dd>
              <dt>Klocka: Intern / Extern</dt>
              <dd>Bestämmer vem som är <em>master</em>. Intern = UnAnalog styr tempot. Extern
                = lyssnar på MIDI-klocka från en annan källa (t.ex. DAW eller trummaskin). Se §17.</dd>
              <dt>Tempo</dt>
              <dd>40–220 BPM. I externt läge visas uppmätt BPM från master istället.</dd>
              <dt>Swing</dt>
              <dd>Skjuter varannat 16-delssteg framåt. 0% = raka, 50–60% = shuffle.</dd>
              <dt>Internt ljud</dt>
              <dd>Om av, tystas inbyggda ljuden men MIDI fortsätter skickas ut. Praktiskt när
                du spelar hårdvara eller en DAW via MIDI och inte vill ha dubbelt ljud.</dd>
              <dt>FILL</dt>
              <dd>Aktiverar steg som har villkoret <code>fill</code>. Tryck på 4:an i takten
                för att simulera en Elektron-fill. Se §7.</dd>
              <dt>⏱ Clock ut</dt>
              <dd>Skickar MIDI-klocka (24 PPQ) + Start/Stop till vald MIDI-ut. Syns bara i
                intern-läge.</dd>
              <dt>Master (–30 … +6 dB)</dt>
              <dd>Global volym för det interna ljudet. En mjuk <em>brickwall-limiter</em> (–0.5 dB)
                ligger permanent efter mastern, så det aldrig clippar även när du drar upp
                eller när många spår spelar samtidigt. Master-värdet delas mellan alla 8 slots
                — den hoppar alltså inte när du byter pattern.</dd>
              <dt>↶ Ångra / ↷ Gör om</dt>
              <dd>Ångrar/återställer senaste ändring. Fungerar även med tangenterna
                {' '}<kbd>Cmd/Ctrl+Z</kbd> och <kbd>Cmd/Ctrl+Shift+Z</kbd>. Se §2.</dd>
            </dl>
            <TipBox>
              Swing låter bra mellan 52–58% på house/hiphop. Över 60% låter det full-on
              swing-jazz.
            </TipBox>
            <TipBox>
              Master styr <em>bara det interna ljudet</em>. MIDI-noter som skickas ut har
              redan sin egen velocity per steg (§7) — mixa nivån i DAWn istället.
            </TipBox>
          </section>

          {/* === 4. KEY === */}
          <section id="man-key">
            <h2>4. Tonart, skala och baseoktav</h2>
            <p>
              Pitch-stegen lagras som <em>skalsteg</em> (1, 2, 3, …), inte som absoluta
              toner. Det betyder att du kan byta tonart eller skala när som helst — mönstret
              följer med.
            </p>
            <dl>
              <dt>Tonart</dt>
              <dd>Grundtonen (C, C#, D …). Flytta upp eller ner hela spelet utan att ändra
                karaktären.</dd>
              <dt>Skala</dt>
              <dd>Major, Minor, Dorian, Phrygian, Minor pentatonic, Blues… Varje skala ger en
                unik känsla.</dd>
              <dt>Baseoktav</dt>
              <dd>Global ton-höjd. Varje spår kan också ha sin egen oktav-shift (§5).</dd>
            </dl>
            <Example>
              Har du en groove i A Minor och vill prova D Phrygian? Ändra bara rot till D och
              skala till Phrygian. Rytmen är densamma, vibben ny.
            </Example>
          </section>

          {/* === 5. TRACKS === */}
          <section id="man-tracks">
            <h2>5. Spår: voices, mute/solo, volym, kanal</h2>
            <p>I spår-listan har varje spår en rad kontroller:</p>
            <dl>
              <dt>Namn</dt>
              <dd>Klicka för att byta. Bara kosmetiskt.</dd>
              <dt>Voice</dt>
              <dd>Inbyggd ljudkälla: <em>Bass</em> (monosyn), <em>Lead</em> (polysyn),{' '}
                <em>Pluck</em>, <em>Kick</em>, <em>Hats</em> (brus-hihat). Voice styr både
                ljudet och vilket MIDI-instrument som passar bäst.</dd>
              <dt>Mute (M) / Solo (S)</dt>
              <dd>Mute tystar spåret. Solo lyssnar bara på de spår som är solo:ade. Flera
                spår kan vara solo samtidigt.</dd>
              <dt>Volym (dB)</dt>
              <dd>Endast för intern-ljudet. MIDI-velocity styrs av gate-stegets velocity
                (§7).</dd>
              <dt>Pan (L/C/R)</dt>
              <dd>Stereoposition. Sliden visar L/C/R + procent. Dubbelklicka för att
                centrera. Påverkar både dry-signalen OCH alla FX-sends, så delay/reverb-
                svansen stannar i samma stereoposition som spåret.</dd>
              <dt>MIDI-kanal</dt>
              <dd>1–16. Matchar kanalen i din DAW eller hårdvara. Sätt varje spår på unik
                kanal så styr du olika instrument på samma enhet.</dd>
              <dt>MIDI-port (per spår)</dt>
              <dd>Valfri — tom = "↳ Global", dvs. den port du valt i MIDI Ut (noter).
                Välj en explicit port om spåret ska gå till en <em>annan</em> fysisk
                enhet än de andra spåren. T.ex. bas → Model D, lead → JT-4000, perc
                → E-MU ESI. Då kan olika spår rutas till helt skilda synter utan
                extern MIDI-router.</dd>
              <dt>Spel-riktning (dir)</dt>
              <dd>
                Inspirerad av Korg SQ-10 / Behringer BQ-10. Varje spår spelar oberoende
                så du kan kombinera olika riktningar för polyrytmiska effekter.
                <ul>
                  <li><strong>▶ Framåt</strong> — standard, 0 → 1 → 2 → … → wrap.</li>
                  <li><strong>◀ Bakåt</strong> — spelar samma steg baklänges. Lägg
                    bakåt på lead-spåret medan bas går framåt → instant variation utan
                    att redigera ett enda step.</li>
                  <li><strong>◀▶ Ping-pong</strong> — studsar mellan ändarna. En full
                    ping-pong-cykel tar 2*(len-1) steg, så ett 8-step-spår blir 14 step
                    långt innan det upprepas. Bra för polymeter mot 16-step bass.</li>
                  <li><strong>🎲 Slump</strong> — varje step plockas helt slumpvis.
                    Glitchy, oförutsägbart. Funkar bra på korta hihat-loopar.</li>
                  <li><strong>➰ Brownian</strong> — random walk (±1 eller står still
                    per step). Tonerna vandrar utan att hoppa stora avstånd → "skälvande
                    melodi" som ändå håller sig i ett område.</li>
                </ul>
              </dd>
              <dt>Oktav-shift</dt>
              <dd>Flyttar bara detta spår ±1 oktav. Bra för bas vs lead.</dd>
            </dl>
            <TipBox>
              <strong>Klassiskt synthwave-trick:</strong> kör samma 8-step arp på två
              spår — ett på <strong>▶ Framåt</strong>, ett på <strong>◀ Bakåt</strong>,
              med olika voice/oktav. Det skapar en "korsning" mitt i takten där spåren
              möts och divergerar igen. Funkar magiskt med en 🌆 Synthwave-preset.
            </TipBox>
            <TipBox>
              Fem spår är default. Tryck "+ Nytt spår" i botten av spår-listan för fler, och
              soptunnan för att ta bort.
            </TipBox>
          </section>

          {/* === 6. PITCH === */}
          <section id="man-pitch">
            <h2>6. Pitch-spåret: toner, oktaver, ackord, glid</h2>
            <p>
              Pitch-raden visar varje steg som en kolumn. Varje kolumn har:
            </p>
            <ul>
              <li>
                <strong>Skalsteg</strong> — 1 är grundtonen, 2 är andra tonen i skalan osv.
                Klicka och dra eller använd piltangenter.
              </li>
              <li>
                <strong>Oktav-offset</strong> (−2 till +2) — lyfter enbart det här steget.
              </li>
              <li>
                <strong>Ackord</strong> — klicka på "+"-knappen för att lägga till extra
                toner på samma steg (t.ex. tersen och kvinten). Ackordet spelas samtidigt.
              </li>
              <li>
                <strong>Glid (slide) + slide-tid</strong> — när slide är på exponeras en
                tid-slider 0–100%. Det förlänger steget mot nästa så internal-voice
                sustainer ut hela glide-tiden OCH MIDI-utgången får legato-overlap (vilket
                triggar portamento på extern synth — JT-4000, Model D etc). 0 = snärtigt,
                100 = full step-längd.
              </li>
            </ul>
            <Example>
              Bygg ett klassiskt acid-arpeggio: ställ gate till 8 steg, pitch 1-1-5-1-3-1-8-1,
              ge stegen 3, 5 och 8 oktav +1. Sätt voice till "Bass". Lägg till slide på varje
              annat steg. Klassiskt!
            </Example>
          </section>

          {/* === 7. GATE === */}
          <section id="man-gate">
            <h2>7. Gate-spåret: rytmen och alla per-steg-parametrar</h2>
            <p>
              Gate-stegen bestämmer <em>när</em> en ton spelas. Klicka på en ruta för att
              aktivera/avaktivera. Varje aktivt steg har en massa gömda reglage som
              ses i mini-panelen på steget:
            </p>
            <dl>
              <dt>Gate-längd (0.1–1.0)</dt>
              <dd>Hur länge tonen hålls av stegets längd. 0.1 = stackato, 1.0 = legato.</dd>
              <dt>Ratchet (1–4)</dt>
              <dd>Delar stegets tid i 2, 3 eller 4 snabba retriggers. 4 låter som en
                burst/drum-roll.</dd>
              <dt>Accent</dt>
              <dd>Boostar velocity +0.2 (upp till max). Hörbar markering av vissa steg.</dd>
              <dt>Probability (🎲 %)</dt>
              <dd>Chans att steget spelas varje takt. 100% = alltid, 25% = ibland. Skapar
                levande variation.</dd>
              <dt>Villkor (Trig condition)</dt>
              <dd>Styr när steget ens är aktuellt. Val: <code>always</code>, <code>p25/50/75</code>,
                {' '}<code>1:2, 2:2, 1:3…4:4</code> (var N:e cykel), <code>prev/notPrev</code>
                {' '}(bara efter att föregående spelade/ej spelade), <code>fill/notFill</code>
                {' '}(bara när FILL-knappen är på).</dd>
              <dt>Velocity (manuell)</dt>
              <dd>Specifik velocity för detta steg (0.05–1.0). Accent och jitter läggs ovanpå.</dd>
              <dt>Filter lock</dt>
              <dd>Låser filter-cutoff för just detta steg (Elektron-style p-lock).</dd>
              <dt>Nudge (±50%)</dt>
              <dd>Mikrojustering av timing. Negativ = tidigare, positiv = senare. Steget får
                en liten visuell förskjutning också.</dd>
            </dl>
            <TipBox>
              Kombinera <code>1:2</code> och <code>2:2</code> på två olika steg för att få
              olika saker att hända varannan takt. Kombinera <code>prev</code> med
              {' '}<code>p50</code> för kedjor som "bara om förra spelade, med 50% chans".
            </TipBox>
            <Example>
              Gör en hihat som lever: slå på alla 16 gates på hats-spåret. Sätt probability
              till 60% på 2:an och 4:an av varje åttondel, 85% på övriga. Sätt accent på
              1:orna. Rytmen känns nu mänsklig istället för mekanisk.
            </Example>
          </section>

          {/* === 8. STEP EDITOR LAYOUT === */}
          <section id="man-stepview">
            <h2>8. Step-editor: kompakt vs detaljerat läge</h2>
            <p>
              I step-editorn slås <em>pitch</em> och <em>gate</em> för samma steg ihop till
              ett enda kort. Det betyder att allt som hör till steget syns på samma ställe
              istället för att pitch ligger i en rad och gate i en annan.
            </p>
            <p>
              Uppe till höger i step-editorn finns en lilla segment-knapp med två lägen:
            </p>
            <dl>
              <dt>Kompakt (default)</dt>
              <dd>Visar bara det viktigaste: ton, skalsteg, oktav, trigger, villkor, accent.
                Sliders för gate-längd, probability, ratchet, velocity och p-lock gömmer sig
                bakom hover — håll musen över kortet för att se värdena som små badges.
                Perfekt när du vill se många steg samtidigt och inte behöver mickla med
                detaljer.</dd>
              <dt>Detaljerat</dt>
              <dd>Fäller ut alla per-steg-reglage direkt i kortet: gate-slider, ratchet,
                probability, velocity, filter-lock, nudge. Väljs när du ska p-locka,
                finjustera timing eller programmera acid-linjer i detalj.</dd>
            </dl>
            <TipBox>
              Kortet är pastellfärgat efter aktivt spår, så du ser direkt vilket spår du
              redigerar. Hela raden wrappar på smalare skärmar så du ska slippa scrolla
              horisontellt.
            </TipBox>
            <Example>
              Ett typiskt flöde: börja i <strong>Kompakt</strong> när du bygger rytmen —
              snabbt att klicka på/av gates och välja toner. När basgången sitter byter du
              till <strong>Detaljerat</strong> på bas-spåret och lägger accent + ratchet där
              det behövs. Växla tillbaka för överblick igen.
            </Example>
          </section>

          {/* === 9. TOOLS === */}
          <section id="man-tools">
            <h2>9. Verktyg — snabba mönsteroperationer</h2>
            <p>Verktyg påverkar alltid det <em>aktiva spåret</em>.</p>
            <dl>
              <dt>Pitch-längd & Gate-längd</dt>
              <dd>Olika längder = polymeter. Prova 7 mot 16 — det tar 7 takter innan det går
                ihop.</dd>
              <dt>Mutera 25%</dt>
              <dd>Slumpar små förändringar i 25% av stegen. Upprepa flera gånger för
                evolution.</dd>
              <dt>Slumpa toner</dt>
              <dd>Helt ny pitch-sekvens inom skalan.</dd>
              <dt>Rensa gates / Alla gates på</dt>
              <dd>Nollställer eller fyller alla gate-steg.</dd>
              <dt>Rotera</dt>
              <dd>Skiftar hela mönstret vänster/höger. "↺ hem" tar dig tillbaka till 0.</dd>
              <dt>Oktav</dt>
              <dd>Samma som oktav-shift i spår-listan, men snabbare att nå.</dd>
              <dt>Euklidisk</dt>
              <dd>Fördelar N pulser så jämnt som möjligt över gate-längden. Klassiska val:
                3/8 (tresa), 5/8 (cumbia), 7/16 (flerlager).</dd>
              <dt>LFO</dt>
              <dd>Långsam oscillator som moduler antingen filter eller volym. Välj rate
                (1/16 till 4 takter), form (sinus/triangel/fyrkant/såg) och djup.</dd>
              <dt>Velocity-jitter</dt>
              <dd>Slumpar velocity ±X% per spelning. Bra humanisering — 5–15% ger liv, 50%+
                blir vildsint.</dd>
              <dt>Humanize nudge</dt>
              <dd>Slumpar timing-nudge på alla steg inom ±styrkan. Klicka upprepat för nya
                varianter. Subtilt: 5–10%. "Drunken MPC": 20–30%.</dd>
              <dt>Filter — Cutoff + Resonans (per-spår baseline)</dt>
              <dd>
                Cutoff-slidern sätter spårets <em>baseline-frekvens</em> (80 Hz–16 kHz, log).
                Per-step <kbd>filter-lock</kbd> och LFO modulerar fortfarande RUNT detta
                värde. Resonansen styr Q (0.7–12). Dubbelklicka för att återgå till
                voice-defaulten.
                <br />
                <strong>Acid-bas-recept:</strong> bass-voice + cutoff 30% + resonans 60%
                + LFO target=filter, depth 70%, rate 4n. Direkt 303-territorium.
              </dd>

              <dt>Sidechain — pump/duck</dt>
              <dd>
                Klassiskt synthwave-trick: bass-spåret pumpar pad-spåret så det "andas"
                i takt. Välj <em>Källa</em> (vilket spår som triggar pumpen), justera
                <em> Pump</em> 0–100% (40–70% är synthwave-sweet-spot) och <em>Release</em>
                50–500 ms (kortare = snärtigt, längre = breath). Pumpen är trigger-baserad
                (per-transient envelope), inte audio-follower — så ratchets pumpar i takt
                med ratcheten.
              </dd>

              <dt>Delay (per-spår-instans)</dt>
              <dd>
                <ul>
                  <li><strong>Mix</strong> — wet-nivå mot delay-bussen.</li>
                  <li><strong>Tid</strong> — musikalisk subdivision: 1/4, 1/8., 1/8, 1/8T,
                    1/16., 1/16, 1/16T, 1/32. Punkterad och triol är mest synthwave-vibb.</li>
                  <li><strong>FB</strong> (feedback) — 0–95%. Över 80% går mot
                    self-oscillation; håll runt 30–60% för smakfullt eko.</li>
                  <li><strong>Mode</strong> — <em>Ping-pong</em> (klassisk stereo),
                    <em> Mono</em> (Space Echo-känsla), <em>Tape</em> (LFO på delaytid →
                    ±5% pitch-svaj, vintage tape-vibration).</li>
                </ul>
              </dd>

              <dt>Reverb — Short + Long sends</dt>
              <dd>
                Två globala reverb-instanser som varje spår skickar till oberoende:
                <ul>
                  <li><strong>Short</strong> (~1.2 s) — intim plate-känsla, bra för leads
                    och attack-färg.</li>
                  <li><strong>Long</strong> (~6.5 s) — synthwave-pad-svans i FM-84-territory.
                    Lägg på pad-spåret + lite på lead för bakgrund.</li>
                </ul>
                Du kan blanda båda för komplexa rumsbilder — kort + lång samtidigt ger
                "intimt med svans".
              </dd>

              <dt>Karaktär — Saturation / Chorus / Crush</dt>
              <dd>
                <ul>
                  <li><strong>Saturation</strong> — drive/tape-mättnad. Värme och brända
                    transienter. Fantastiskt på hats och bas.</li>
                  <li><strong>Chorus</strong> — stereo-chorus 1.5 Hz / depth 0.7 / spread
                    180°. Tjockar leads och pad i bredden. <em>Synthwave-essentiellt</em>.</li>
                  <li><strong>Crush</strong> — bitcrusher 8-bit ner mot 2-bit. Glitch/lo-fi
                    på hats och perc; försiktigt på melodisk material.</li>
                </ul>
                <kbd>↺ Torrt</kbd> nollställer alla mix-värden.
              </dd>
            </dl>
            <TipBox>
              <strong>🌆 Synthwave FX-recept:</strong>
              <ol>
                <li>Bas: cutoff 35%, reso 30%, mono delay 15% @ 1/16, FB 40%, lite saturation 20%.</li>
                <li>Lead: chorus 40%, short reverb 30%, ping-pong delay 25% @ 1/8., FB 45%.</li>
                <li>Pad: long reverb 70%, chorus 60%, sidechain källa = bass-spåret, pump 55%, release 200 ms.</li>
                <li>Hats: short reverb 15%, crush 30%, saturation 35%, hård panning ±60%.</li>
              </ol>
              Kombinationen av sidechain, lång reverb och chorus ÄR synthwave-soundtracket.
            </TipBox>
          </section>

          {/* === 10. QUICK ACTIONS === */}
          <section id="man-quick">
            <h2>10. Snabbåtgärder & copy/paste av rader</h2>
            <p>
              Raden ovanför step-editorn samlar de oftast använda operationerna så du
              slipper scrolla upp till Verktyg-panelen.
            </p>
            <dl>
              <dt>▢ Rensa gates / ■ Alla på</dt>
              <dd>Släcker eller tänder alla gate-steg på aktivt spår.</dd>
              <dt>🎲 Slumpa toner / ✶ Mutera</dt>
              <dd>Samma som i Verktyg, men ett klick bort från stegen du just redigerar.</dd>
              <dt>📋 Kopiera pitch / 📋 Kopiera gate</dt>
              <dd>
                Lägger aktuella spårets pitch- eller gate-rad i ett internt clipboard.
                Pitch-clipboarden innehåller skalsteg, oktaver, slide och ackord-noter.
                Gate-clipboarden innehåller trigger, gate-längd, probability, ratchet,
                accent, villkor, filter-lock, velocity <em>och</em> nudge — alltså allt
                som hör till rytmen.
              </dd>
              <dt>📥 Klistra (pitch/gate)</dt>
              <dd>
                Ersätter motsvarande rad på aktuellt spår. Knappen visar vilken typ som
                ligger i clipboarden. Är mottagarens rad längre än källan loopas källan
                (så du kan kopiera ett 4-stegs mönster till 16 steg och få samma idé fyra
                gånger).
              </dd>
            </dl>
            <TipBox>
              Copy/paste funkar även <em>mellan slots</em>. Kopiera hats-rytmen i slot A,
              byt till slot B (eller använd <kbd>2</kbd>-tangenten från §2), byt till
              hats-spåret och klistra. Idealt för variationer där bara ett spår byts.
            </TipBox>
            <Example>
              Bygg en call/response: på slot A gör du en bas-fras. Kopiera dess pitch-rad,
              byt till slot B, klistra på lead-spåret — nu spelar leaden samma melodi en
              oktav upp (sätt spårets oktav-shift till +1). Ångra allt med <kbd>Cmd+Z</kbd>
              om du ändrar dig.
            </Example>
          </section>

          {/* === 11. STYLES === */}
          <section id="man-styles">
            <h2>11. Stilpresets + 🎲 Slumpa nytt pattern</h2>
            <p>
              Stilpresets ger en typisk rytm/melodi för en genre. Det finns två olika
              knappar här — lätta att blanda ihop men med väldigt olika effekt:
            </p>
            <h3>Stil-chips (Ambient · Acid · Berlin · IDM · Chillout · 🌆 Synthwave · 🏁 Outrun)</h3>
            <p>
              Varje chip skriver över <em>bara det aktiva spåret</em> med pitch + gate-rad
              för den stilen. Allt annat (tempo, skala, övriga spår) lämnas i fred. Perfekt
              när du vill byta karaktär på ett enskilt spår.
            </p>
            <TipBox>
              <strong>🌆 Synthwave</strong> ger den klassiska Nightcall/Kavinsky-arpen: moll,
              95 BPM, grundton + kvint som studsar mellan två oktaver. Testa att välja{' '}
              <em>minor</em> i skala-väljaren och ett bass-spår som lead-voice —
              du får nattlig motorväg direkt. Lägg till pad med reverb för retrodröm.
              <br />
              <strong>🏁 Outrun</strong> är mer episk: harmonisk moll, driving 16-del,
              slides var fjärde, dubbelträff på näst sista steget. Byt skala till
              <em>harmonisk moll</em> för Carpenter Brut/FM-84-action. Ett bra grepp är
              att slumpa med 🎲 Outrun → det sätter hela patternet + tempo runt 118 BPM.
            </TipBox>
            <h3>🎲 Slumpa nytt pattern</h3>
            <p>
              Välj genre i dropdown:en bredvid och klicka. Nu bygger UnAnalog ett
              <em> komplett nytt pattern</em> utifrån stilens profil — alla spår (bas,
              lead, hats, pad …), tempo inom genrens typiska intervall, skala som passar
              och lagom swing. Klicka igen för nästa idé.
            </p>
            <TipBox>
              Båda knapparna skriver över utan bekräftelse, men undo-historiken fångar
              dem. Ångra med <kbd>Cmd/Ctrl+Z</kbd> om du hellre vill fortsätta med det du
              hade. Profilerna justerar rytm-densitet, slides, ratchets, accenter och
              oktav-hopp efter genrens typiska kännetecken.
            </TipBox>
            <Example>
              Jamma forskande: välj <strong>IDM</strong> och 🎲 tills nåt fastnar. Bevara
              det genom att spara till en slot (§14) och slumpa sedan ett <strong>Ambient</strong>
              {' '}i slot B som kontrast. Kedja ihop dem med Song chain (§15).
            </Example>
          </section>

          {/* === 12. CHORD === */}
          <section id="man-chord">
            <h2>12. Ackord-input, sekvensinspelning & loop-rec</h2>
            <p>Det finns tre sätt att mata in toner från ett MIDI-keyboard:</p>

            <h3>A) Spela ackord (alla toner samtidigt)</h3>
            <ol>
              <li>Välj en arp-riktning (upp, ner, slump, fram &amp; tillbaka, ping-pong, stapla).</li>
              <li>Klicka <kbd>◉ Spela ackord</kbd>.</li>
              <li>Håll ner alla toner samtidigt på keyboardet.</li>
              <li>Släpp alla toner — UnAnalog fördelar dem över pitch-stegen enligt
                riktningen. Tonerna sorteras efter tonhöjd innan de ordnas.</li>
            </ol>
            <Example>
              Spela C-E-G-B (Cmaj7), välj "upp". Resultat: C → E → G → B på fyra steg.
              Välj "stapla" istället så hamnar hela ackordet på ett enda steg (som ett
              riktigt ackord).
            </Example>

            <h3>B) Spela in toner (ton för ton, ordningen bevaras)</h3>
            <ol>
              <li>Klicka <kbd>🎹 Spela in toner</kbd>.</li>
              <li>Spela en melodi en ton i taget. Paus mellan tonerna spelar ingen roll —
                endast ordningen räknas.</li>
              <li>Ångra senaste ton med <kbd>↺ Ångra ton</kbd> om du missar.</li>
              <li>Klicka <kbd>✓ Klart</kbd> för att skicka hela sekvensen till aktiva spåret.</li>
            </ol>
            <TipBox>
              Till skillnad från ackord-läget bevaras exakt din inmatningsordning, och
              dubletter räknas — spelar du C-E-C-G blir det fyra steg. Perfekt för snabbt
              skissa melodilinjer.
            </TipBox>
            <Example>
              Spela in en acid-bas: <code>A → A → E → A → C → A → G → A</code>. Åtta toner
              → åtta pitch-steg, gates blir aktiva på alla. Lägg sedan oktav-offset och slide
              per steg för den karaktäristiska 303-känslan.
            </Example>

            <h3>C) Loop-inspelning live — jamma direkt in i loopen</h3>
            <p>
              Vill du jamma ovanpå det som redan spelar och låta ett ackord eller en melodi
              landa direkt i aktiva spårets gridd? Då är <kbd>● Rec</kbd>-knappen (röd cirkel
              bredvid Play) det du vill ha. Sequencern fortsätter loopa, din spelning skrivs
              in i realtid och du hör dig själv plus resten av patterns samtidigt.
            </p>
            <ol>
              <li>Välj det spår du vill skriva till (<kbd>Z</kbd>/<kbd>X</kbd> eller klicka
                på spåret i TrackStrip).</li>
              <li>Tryck <kbd>● Rec</kbd>. Knappen blir gul (<strong>Arm</strong>) och börjar
                skriva vid nästa takt-gräns — clean start, inga halva noter från mitt i takten.</li>
              <li>Spela. Varje not kvantiseras automatiskt till närmaste 16-del och närmaste
                skalston (så du hamnar inom vald skala). Gate-längden byggs från hur länge du
                håller tangenten — staccato-puttar ger korta gates, sustain ger gate = 1.</li>
              <li>Overdub: spela fler noter på samma step och de läggs till som extraNotes
                (ackord). Nya steg tar velocity från anslaget (accent sätts automatiskt vid
                velocity &gt; 0.85).</li>
              <li>Tryck <kbd>● Rec</kbd> igen för att stoppa (eller tryck Stop). Hela passet
                blir <em>ett</em> undo-steg — <kbd>Cmd/Ctrl+Z</kbd> tar bort allt du just
                spelade in, inte en not i taget.</li>
            </ol>
            <TipBox>
              Rec aktiverar automatiskt Play om sequencern är stoppad — du kan trycka Rec
              direkt utan att först starta transport. Din MIDI-ingång (keyboard eller IAC-buss)
              hittas automatiskt — ingen separat ingångs-dropdown behövs för inspelning.
            </TipBox>
            <TipBox>
              Vill du ersätta en rad i stället för att lägga till? Rensa raden först med
              "Rensa gates" (§10) eller trycka <kbd>Cmd/Ctrl+Z</kbd> om du precis spelade in.
              Overdub är default — så du kan bygga upp ett komp genom att jamma flera pass.
            </TipBox>
            <Example>
              Lägg ett ackord-komp: välj pad-spåret, tryck <kbd>● Rec</kbd>, spela C-E-G-B och
              håll i en hel takt. Släpp vid next bar. Resultat: fyra toner på step 1 (stapel),
              gate = 1 (hela takten). Kör Rec igen och lägg på en bas-linje på step 5 och 9 —
              fyller på utan att rensa vad du redan har.
            </Example>

            <TipBox>
              Ingen hårdvara? Du kan fortfarande välja MIDI-in i listan — vilket keyboard
              eller pad-controller som helst som webbläsaren ser duger (macOS IAC-buss funkar
              också — skicka från DAW eller annan app).
            </TipBox>
          </section>

          {/* === 13. MIDI IMPORT === */}
          <section id="man-midi-import">
            <h2>13. MIDI-import</h2>
            <p>
              Dra en .mid-fil till "MIDI Import"-rutan eller välj via knappen. Välj sedan
              vilket spår (track) i filen du vill hämta och kvantisering (1/16, 1/8…).
              UnAnalog extraherar noterna och lägger dem på aktiva spåret. Ackord bevaras.
            </p>
            <TipBox>
              Kvantisering <strong>1/16</strong> passar de flesta loopar. För swingade MIDI
              kan 1/8T eller 1/16T ge bättre resultat.
            </TipBox>
          </section>

          {/* === 14. BANK === */}
          <section id="man-bank">
            <h2>14. Pattern bank: spara, ladda, exportera</h2>
            <p>
              8 slottar (A–H). Klicka för att byta, dubbelklicka (eller "Rensa") för att
              tömma. Alla slots + bank-inställningar autosparas i webbläsaren.
            </p>
            <dl>
              <dt>Sync-läge</dt>
              <dd><em>Genast</em> hoppar direkt när du byter slot. <em>Nästa takt</em> väntar
                till taktstart — musikaliskt rent.</dd>
              <dt>⬇ JSON</dt>
              <dd>Laddar ner hela banken (alla 8 slots + inställningar) som JSON. Du kan ange
                eget filnamn i textrutan, annars blir det{' '}
                <code>unanalog-bank-YYYY-MM-DD.json</code>.</dd>
              <dt>⬆ Import</dt>
              <dd>Välj en tidigare exporterad JSON. Gammal bank ersätts.</dd>
              <dt>🎹 MIDI (.mid)</dt>
              <dd>Exporterar <em>bara aktiv slot</em> som standardiserad MIDI-fil (SMF Type 1).
                Varje spår blir en egen MIDI-track med sin kanal, namn och noter. Filen kan
                öppnas i Logic, Ableton, Cubase, FL Studio, Reaper osv.</dd>
              <dt>takter</dt>
              <dd>Hur många takter som renderas i MIDI-filen (1–32). 4 takter räcker för en
                loop; 16–32 för en genomspelning där villkoren (1:4, 2:3 osv.) hinner cykla.</dd>
            </dl>
            <h3>MIDI-export: vad tas med?</h3>
            <ul>
              <li>Alla aktiva gate-steg, ratchet-retriggers, ackord-noter, nudge och velocity.</li>
              <li>Accent (+0.2 velocity) och gate-stegets egna velocity-värde.</li>
              <li>Polymeter: spår med olika pitch/gate-längd rullas korrekt över takterna.</li>
              <li>Villkor (<code>1:2</code>, <code>2:4</code>, <code>prev</code> …) evalueras
                deterministiskt från takt 0. Probability under 50% hoppas över i exporten
                (annars blir filen olika varje gång).</li>
              <li>Tempo + 4/4 time signature i headern.</li>
            </ul>
            <h3>Vad tas <em>inte</em> med?</h3>
            <ul>
              <li>Swing (grid exporteras rakt — lägg swing i DAW:en istället).</li>
              <li>LFO och filter-lock (synth-specifikt, inte generell MIDI-information).</li>
              <li>Slide/portamento (kan läggas till senare som CC65+CC5 om behov finns).</li>
            </ul>
            <Example>
              Jobbar du på en låt? Döp exporten till <code>house-jam-1</code> → klick på
              {' '}<kbd>⬇ JSON</kbd> ger <code>house-jam-1.json</code>, klick på{' '}
              <kbd>🎹 MIDI</kbd> ger <code>house-jam-1.mid</code>. Importera .mid i din DAW på
              {' '}en Software Instrument-track och spela vidare där.
            </Example>
            <TipBox>
              För en riktigt stabil export: sätt probability till 100% på de steg du vill
              garantera, eller till 0% på de du vill utesluta. Mellanvärden (51–99%) spelas
              alltid i exporten, 1–50% utelämnas.
            </TipBox>
          </section>

          {/* === 15. SONG === */}
          <section id="man-song">
            <h2>15. Song chain — kedja patterns</h2>
            <p>
              Aktivera <em>Song mode</em> och definiera en lista av slots, t.ex. A → A → B →
              A → C. Varje takt byter UnAnalog automatiskt till nästa slot. Klicka på ett steg
              i kedjan för att hoppa dit direkt.
            </p>
            <TipBox>
              Klassisk låtstruktur: intro (A) · vers (B × 2) · bridge (C) · refräng (D × 2).
              Sätt upp 8 steg så spelas det av sig självt.
            </TipBox>
          </section>

          {/* === 16. MIDI OUT === */}
          <section id="man-midi-out">
            <h2>16. MIDI ut — styra DAW / hårdvara</h2>
            <p>
              UnAnalog har tre nivåer av MIDI-routing:
            </p>
            <dl>
              <dt>🎹 MIDI Ut (noter) — global</dt>
              <dd>Standardport för <em>alla</em> spårens noter. Varje spårs MIDI-kanal
                (§5) styr kanalen på den porten.</dd>
              <dt>⏱ Clock Ut — synk</dt>
              <dd>Separat port för MIDI Clock (24 PPQ) + Start/Stop/SPP. Kan vara
                samma som noter eller en helt annan — då kan t.ex. en trummaskin
                bara få clock utan att triggas av sequencer-noter.</dd>
              <dt>🎚 Per-spår MIDI-port</dt>
              <dd>I spår-listan (§5) kan varje spår välja en <em>egen</em> port som
                överstyr den globala. "↳ Global" = fall tillbaka på den globala. Gör
                att ett enda pattern kan spela flera fysiska enheter samtidigt utan
                extern MIDI-router.</dd>
            </dl>

            <h3>Flera hårdvarusyntar samtidigt</h3>
            <p>
              Säg att du har Behringer Model D (USB), Roland JT-4000 (USB), Roland
              JV-1010 (USB) och E-MU ESI (DIN via USB-MIDI-interface) + en LMDrum
              (USB) för synk. Så här mappar du det:
            </p>
            <ul>
              <li><strong>Bas-spår:</strong> port = Model D, kanal = 1 (monotimbral)</li>
              <li><strong>Lead-spår:</strong> port = JT-4000, kanal = 1</li>
              <li><strong>Pad-spår:</strong> port = JV-1010, kanal = 1</li>
              <li><strong>Perc-spår A:</strong> port = E-MU ESI, kanal = 10 (multitimbral)</li>
              <li><strong>Perc-spår B:</strong> port = E-MU ESI, kanal = 11</li>
              <li><strong>Global Clock Ut:</strong> LMDrum (synkstartar takt 1)</li>
            </ul>
            <p>
              Sätt <strong>🎹 MIDI Ut (global)</strong> till "(ingen — tyst MIDI)" eller
              valfri default så ingen oavsiktlig not går fel ifall ett spår saknar
              explicit port.
            </p>

            <h3>DAW-inspelning via virtuell MIDI-buss (macOS / Windows)</h3>
            <p>
              Vill du spela in ditt jam i en DAW (Logic, Ableton, Bitwig, Reaper,
              Cubase…) är det enklaste att låta DAWn ligga som MIDI-hub mellan
              UnAnalog och hårdvarusyntarna:
            </p>
            <ol>
              <li>
                <strong>macOS:</strong> Öppna <em>Audio MIDI Setup</em> → dubbelklicka
                "IAC Driver" → kryssa "Device is online" → lägg till så många bussar
                du behöver (IAC Bus 1, 2, 3…).<br />
                <strong>Windows:</strong> installera <em>loopMIDI</em> (gratis) och
                skapa virtuella portar på samma sätt.
              </li>
              <li>
                I UnAnalog: sätt varje spårs <strong>port</strong> till en IAC-buss
                (t.ex. bas → IAC Bus 1, lead → IAC Bus 2).
              </li>
              <li>
                I DAWn: skapa en MIDI- eller External Instrument-track per IAC-buss
                som spelar in. Sätt varje tracks MIDI-utgång till rätt fysisk synt.
                Då spelar DAWn in exakt vad UnAnalog skickar, samtidigt som ljudet
                går vidare till den verkliga hårdvaran.
              </li>
              <li>
                <strong>Alternativ 1-kanal-setup:</strong> Lägg allt på IAC Bus 1,
                låt DAWn ta emot där och splitta per kanal i olika tracks. Enklare
                men du binder routing-logiken till DAWn istället för UnAnalog.
              </li>
            </ol>
            <TipBox>
              Vill du bara ha MIDI och inget ljud från UnAnalog? Stäng av{' '}
              <em>Internt ljud</em> i transport.
            </TipBox>
            <TipBox>
              Clock fungerar parallellt med DAW-inspelning. Sätt ⏱ Clock Ut till
              samma IAC-buss som DAWn lyssnar på, så spelar DAWn in både clock och
              noter — perfekt för att rekonstruera jamet senare.
            </TipBox>
          </section>

          {/* === 17. CLOCK === */}
          <section id="man-clock">
            <h2>17. MIDI Clock in/ut — synka med annan utrustning</h2>
            <p>
              MIDI-klocka (24 PPQ) + Start/Stop/Continue-meddelanden låter flera enheter
              följa samma tempo.
            </p>
            <h3>Intern klocka (UnAnalog är master)</h3>
            <ol>
              <li>Välj <strong>⏱ Clock Ut — synk</strong> i MIDI-rutan och peka
                på den enhet som ska ta emot klocka (t.ex. trummaskinen).</li>
              <li>Slå på <kbd>⏱ Clock ut</kbd> i transport. Fältet är gråat tills
                du valt en clock-port.</li>
              <li>Din enhet måste vara i <em>slave-läge</em> (Sync = External/MIDI).</li>
            </ol>
            <p>
              UnAnalog skickar automatiskt <strong>Song Position Pointer = 0</strong> före
              Start, så trummaskinen börjar från takt 1 även om den var satt på en annan
              position. Det är avgörande för bl.a. flera Behringer- och Elektron-enheter.
            </p>
            <h3>Extern klocka (UnAnalog följer master)</h3>
            <ol>
              <li>Klicka <strong>Klocka: Extern</strong>.</li>
              <li>
                Tryck <kbd>▶ Lyssna</kbd>. Webbläsaren låser upp ljud och armar
                klock-lyssnaren.
              </li>
              <li>
                Starta uppspelning i mastern (t.ex. tryck play i Logic med "Send MIDI Clock"
                aktiverat). UnAnalog läser tempot live och följer Start/Stop automatiskt.
              </li>
            </ol>
            <TipBox>
              "Clock ut" döljs automatiskt i externt läge för att undvika feedback-loopar —
              det vore dumt att skicka tillbaka klockan till den som skickade den.
            </TipBox>
            <TipBox>
              Funkar inte synken? Öppna <strong>🔧 MIDI-diagnostik</strong> i samma zon
              som MIDI Ut-rutan. Där ser du live-LEDs, kan skicka testnoter och en 1-takts
              testclock för att isolera var felet är. Se §18.
            </TipBox>
            <Example>
              Scenario: Logic kör trummorna och skickar klocka, UnAnalog synkar sin bassline
              och lead ovanpå. Sätt UnAnalogs MIDI ut = IAC Bus 2 så går Logic-trummor in
              separat från UnAnalog-synten.
            </Example>
            <Example>
              <strong>Trummaskin + synt, båda via USB:</strong> Säg att du har en
              Behringer LMDrum <em>och</em> en JT-4000 synt. Sätt 🎹 MIDI Ut = JT-4000
              och ⏱ Clock Ut = LMDrum. Då får trummisen bara clock (synkstartar exakt)
              och synten får noter enligt spårens MIDI-kanaler — utan att trummisen
              börjar trumla slumpmässigt för att sequencer-noter råkar gå till kanal 10.
            </Example>
          </section>

          {/* === 18. MIDI-DIAGNOSTIK === */}
          <section id="man-diag">
            <h2>18. 🔧 MIDI-diagnostik — felsök synk & portar</h2>
            <p>
              Direkt under <em>Tonart & skala</em>-panelen (där du väljer MIDI-utgång) finns en
              fällbar sektion med <strong>MIDI-diagnostik</strong>. Klicka på rubriken för att
              fälla ut den. Det här är ditt bästa verktyg när clock-synk inte vill lira med
              hårdvara.
            </p>
            <h3>Vad du ser</h3>
            <dl>
              <dt>MIDI Ut — lista över utgångar</dt>
              <dd>Varje port har en liten grön prick när den är <em>connected</em>. Prickens
                tooltip visar även om porten är <code>open/closed/pending</code>. UnAnalog
                försöker automatiskt öppna alla portar — om en är <code>closed</code> på
                Windows är det en tydlig ledtråd att drivrutinen inte är OK.</dd>
              <dt>MIDI In — lista över ingångar</dt>
              <dd>Samma sak för dina keyboards och master-klockor. Här syns också
                trummaskinen om den kan skicka clock tillbaka till datorn.</dd>
              <dt>Live-LEDs</dt>
              <dd>Varje port har små lysdioder: <strong>CLK</strong> blinkar på varje
                clock-puls, <strong>START</strong> på 0xFA, <strong>STOP</strong> på 0xFC,
                <strong>NOTE</strong> på note-on, <strong>CC</strong> på kontrollmeddelanden
                (bara på in-sidan). Dioderna släcks efter ~400 ms.</dd>
              <dt>"Senaste mottagna"-ruta</dt>
              <dd>Visar senaste icke-clock-meddelandet i hex, t.ex.{' '}
                <code>START [fa]  ← LMDrum</code>. Rena clock-pulser filtreras bort så du
                faktiskt ser Start/Stop/Notes även när mastern är igång.</dd>
            </dl>
            <h3>Test-knappar</h3>
            <dl>
              <dt>🎵 Skicka testnot</dt>
              <dd>Skickar en Note-On/Off (C4, 250 ms) på vald kanal till aktiv MIDI-ut.
                Verifierar att vägen dator → trummaskin funkar <em>innan</em> du ger dig på
                klocksynk.</dd>
              <dt>⏱ 1 takt testclock</dt>
              <dd>Skickar <strong>Start + 96 clock-pulser + Stop</strong> (en takt @ 4/4)
                via <code>performance.now()</code>-tidsstämplar. Om trummaskinen är korrekt
                konfigurerad ska den gå exakt fyra kvartsnoter och sen stanna. Om tempot är
                halverat eller dubblat har enheten en egen Clock In-divider.</dd>
              <dt>⟳ Uppdatera portar</dt>
              <dd>Tvingar en re-read. Använd efter att du dragit ur/in USB-kabeln utan att
                listan uppdaterades automatiskt.</dd>
            </dl>
            <h3>Felsökningsflöde — trummaskin som slave (UnAnalog = master)</h3>
            <ol>
              <li>Är trummaskinen listad under <strong>MIDI Ut</strong>? Nej → USB/drivrutin.</li>
              <li>
                Tryck <kbd>🎵 Skicka testnot</kbd>. Blinkar NOTE-LED på porten? Spelar
                trumman ljud? Nej → trumman lyssnar inte på rätt kanal.
              </li>
              <li>
                Slå på <kbd>⏱ Clock ut</kbd> i transport och starta UnAnalog.
                Blinkar CLK-LED 24 ggr/kvartsnot? Nej → ingen clock skickas, kolla att
                "Clock ut" är på.
              </li>
              <li>
                Om CLK blinkar men trumman inte följer → trumman har
                <em>MIDI Sync In</em> eller <em>External Clock</em> avslaget i sin meny.
                (På Behringer LMDrum: Menu → Settings → Sync = MIDI.)
              </li>
              <li>
                Som sista kontroll: tryck <kbd>⏱ 1 takt testclock</kbd>. Om trumman gör
                exakt en takt → synken är frisk, det var din pattern-konfig. Om den gör
                "nästan" men fel tempo → Clock In Ratio behöver ställas på trumman.
              </li>
            </ol>
            <h3>Felsökningsflöde — UnAnalog som slave (trummaskin = master)</h3>
            <ol>
              <li>Är trummaskinen listad under <strong>MIDI In</strong>? Nej → USB-kabel /
                trumman skickar ingen clock.</li>
              <li>Starta uppspelning på trumman. Blinkar CLK-LED på dess in-port? Nej →
                trumman har <em>MIDI Clock Out</em> avstängt.</li>
              <li>Sätt <strong>Klocka: Extern</strong> och tryck <kbd>▶ Lyssna</kbd>.</li>
              <li>Tryck Play på trumman. START-LED ska blinka en gång; därefter spelar
                UnAnalog synkat.</li>
              <li>Om START inte kommer → trumman skickar clock men inte Start/Stop.
                (Ovanligt, men vissa enheter har separat inställning för
                "Transmit MMC/Transport" vs "Transmit Clock".)</li>
            </ol>
            <TipBox>
              Diagnostik-panelen är passiv — den påverkar inte ljud eller tajming. Du kan
              låta den vara öppen hela tiden om du vill.
            </TipBox>
          </section>

          {/* === 19. TIPS === */}
          <section id="man-tips">
            <h2>19. Tips, idéer och felsökning</h2>
            <h3>Kreativa tips</h3>
            <ul>
              <li>Olika pitch- och gate-längd ger polymeter utan extra jobb. Prova 7 vs 16.</li>
              <li>Mutera 25% upprepat = generativ evolution. Spara bra resultat till en slot.</li>
              <li>Kombinera villkor: ett steg med <code>1:3</code> och ett med <code>2:3</code>
                spelar aldrig samtidigt.</li>
              <li>LFO på filter + en lång gate-länd = bubblig acid-textur.</li>
              <li>Lägg tunna ackord på pluck/lead och solo-noter på bass. Det är ofta där
                magin finns.</li>
              <li>🎲 Slumpa nytt pattern (§11) → om 1 av 10 resultat känns rätt, spara
                genast till en slot. Sen slumpa vidare.</li>
              <li>Per-spår saturation (§9) på hats är ett snabbt sätt att få dem att sticka
                ut utan att skruva upp volymen.</li>
            </ul>
            <h3>Jam-workflow</h3>
            <ul>
              <li><kbd>Space</kbd> startar/stoppar. <kbd>Z</kbd>/<kbd>X</kbd> byter spår,
                <kbd>Q</kbd> muta, <kbd>W</kbd> solo. <kbd>1–8</kbd> hoppar slot.</li>
              <li>Kopiera en rad med 📋, byt spår, klistra in med 📥 — det går fortare än
                att bygga om rytmen manuellt.</li>
              <li>Har du klickat fel? <kbd>Cmd/Ctrl+Z</kbd> — upp till 60 steg bakåt.</li>
            </ul>
            <h3>Felsökning</h3>
            <dl>
              <dt>Inget ljud?</dt>
              <dd>Klicka ▶ Spela en gång (webbläsaren kräver user-gesture). Kolla att "Internt
                ljud" är på. Kolla volym på aktiva spåret. Ingen mute? Kolla även master-slidern
                — har den dragits ned till –30 dB så är det nästan tyst.</dd>
              <dt>Det klipper / brusar</dt>
              <dd>Osannolikt — master-limitern (§3) är alltid på. Men om ett spårs saturation
                står på 100% kan det låta "varmt". Dra ned på det eller tryck <kbd>↺ Torrt</kbd>
                {' '}i FX-raden för att nollställa.</dd>
              <dt>Tangent-genvägar triggar inte</dt>
              <dd>Kolla att fokus inte ligger i ett input-fält (t.ex. tempo). Klicka utanför
                först. Shortcuts är medvetet avstängda i formulärfält så du kan skriva
                siffror utan att Space startar uppspelningen.</dd>
              <dt>Cmd+Z ångrar fel sak</dt>
              <dd>Import och engine-automatik (song mode-slot-byten, bar-sync) spelas
                medvetet <em>inte</em> in i historiken. Om du just har importerat en bank
                och trycker undo kommer du inte tillbaka till gamla banken — den är borta.</dd>
              <dt>MIDI-ut visar ingen port</dt>
              <dd>Tillåt MIDI i webbläsaren (prompten kommer första gången). Kolla att du
                har en port aktiv i Audio MIDI Setup (macOS) eller loopMIDI (Windows).</dd>
              <dt>Extern klocka fungerar inte</dt>
              <dd>Säkerställ att master verkligen skickar MIDI-klocka (t.ex. Logic:
                File → Project Settings → Synchronization → MIDI → "Transmit MIDI Clock").
                Tryck ▶ Lyssna i UnAnalog <em>före</em> du startar mastern. Öppna
                <strong> 🔧 MIDI-diagnostik</strong> (§18) för att se om CLK-LED
                faktiskt blinkar på rätt in-port.</dd>
              <dt>Trummaskin följer inte clock</dt>
              <dd>Öppna §18 MIDI-diagnostik. Följ felsökningsflödet där — det visar steg
                för steg var signalen bryter.</dd>
              <dt>Samma hash vid rebuild fast jag ändrat kod</dt>
              <dd>Leta efter gamla <code>.js</code>-filer i <code>src/</code> som skuggar
                dina <code>.tsx</code>. Ta bort dem och bygg om.</dd>
            </dl>
          </section>

          {/* === 20. CREDITS === */}
          <section id="man-credits">
            <h2>20. Credits & copyright</h2>
            <p>
              <strong>{APP_META.name}</strong> · version {APP_META.version}
              <br />
              © {APP_META.year} {APP_META.owner}
              <br />
              {APP_META.license}
            </p>
            <p>
              Byggd med React, TypeScript, Tone.js och Web MIDI API.
            </p>
            <p className="muted">
              Tips: vill du ändra namn eller licens, öppna <code>src/meta.ts</code> och
              redigera fälten där — det slår igenom på alla ställen i appen.
            </p>
          </section>

          <div className="manual__footer">
            <button className="btn btn--primary" onClick={onClose}>Stäng manualen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TipBox({ children }: { children: ReactNode }) {
  return (
    <aside className="manual__tip">
      <span className="manual__tip-icon" aria-hidden>💡</span>
      <div>{children}</div>
    </aside>
  );
}

function Example({ children }: { children: ReactNode }) {
  return (
    <aside className="manual__example">
      <span className="manual__example-label">Exempel</span>
      <div>{children}</div>
    </aside>
  );
}

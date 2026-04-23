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
  { id: 'tools', title: '9. Verktyg: längder, euklidisk, rotera, LFO, jitter, humanize, FX' },
  { id: 'quick', title: '10. Snabbåtgärder & copy/paste av rader' },
  { id: 'styles', title: '11. Stilpresets + 🎲 Slumpa nytt pattern' },
  { id: 'chord', title: '12. Ackord-input & sekvensinspelning' },
  { id: 'midi-import', title: '13. MIDI-import' },
  { id: 'bank', title: '14. Pattern bank: spara, ladda, exportera' },
  { id: 'song', title: '15. Song chain — kedja patterns' },
  { id: 'midi-out', title: '16. MIDI ut — styra Logic/hårdvara' },
  { id: 'clock', title: '17. MIDI Clock in/ut — synka med annan utrustning' },
  { id: 'tips', title: '18. Tips, idéer och felsökning' },
  { id: 'credits', title: '19. Credits & copyright' },
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
                = lyssnar på MIDI-klocka från en annan källa (t.ex. Logic). Se §17.</dd>
              <dt>Tempo</dt>
              <dd>40–220 BPM. I externt läge visas uppmätt BPM från master istället.</dd>
              <dt>Swing</dt>
              <dd>Skjuter varannat 16-delssteg framåt. 0% = raka, 50–60% = shuffle.</dd>
              <dt>Internt ljud</dt>
              <dd>Om av, tystas inbyggda ljuden men MIDI fortsätter skickas ut. Praktiskt när
                du spelar Logic via MIDI och inte vill ha dubbelt ljud.</dd>
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
              redan sin egen velocity per steg (§7) — mixa nivån i Logic istället.
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
              <dt>MIDI-kanal</dt>
              <dd>1–16. Matchar kanalen i Logic eller din hårdvara. Sätt varje spår på unik
                kanal så styr du olika instrument.</dd>
              <dt>Oktav-shift</dt>
              <dd>Flyttar bara detta spår ±1 oktav. Bra för bas vs lead.</dd>
            </dl>
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
                <strong>Glid (slide)</strong> — skickar slide-info över MIDI. Vissa
                Logic-instrument (t.ex. ES2) reagerar på portamento-CC.
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
              <dt>Effekter — Delay / Reverb / Saturation</dt>
              <dd>
                Per-spår FX-send. Varje spår har sin egen wet-nivå (0–100%), men nodsatsen
                är delad globalt så cpu-kostnaden håller sig låg oavsett antal spår:
                <ul>
                  <li><strong>Delay</strong> — ping-pong sync:ad till 1/8. Ger rum och
                    rörelse. Fungerar extra bra på sparsamma leads/pluckar.</li>
                  <li><strong>Reverb</strong> — stor hall (~3.2 s decay). Mjukar soundet
                    och sätter spåret i ett rum. För mycket på bas → plottrigt, så dosera
                    lätt där.</li>
                  <li><strong>Saturation</strong> — parallell drive/tape-mättnad. Lägger
                    analog värme och bränner upp transienter. Fantastiskt på hats och bas,
                    försiktigt på pads.</li>
                </ul>
                <kbd>↺ Torrt</kbd> nollställer alla tre på aktivt spår.
              </dd>
            </dl>
            <TipBox>
              Delay och reverb är <em>delade</em> noder — så du hör inte reverb-svans från
              ett spår som råkar dela våg med ett annat. Men saturation är parallell per
              spår och blandas in efter spårets dry-signal, så det låter naturligt bredvid
              ett helt rent spår.
            </TipBox>
            <Example>
              Klassisk dub-feel: lite delay (40%) på lead-spåret, accent på 1:orna,
              probability 60% på ratchets. Sätt reverb (25%) på pad-spåret för att få
              bakgrund. Låt bas och hats vara helt torra.
            </Example>
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
            <h3>Stil-chips (Ambient · Acid · Berlin · IDM · Chillout)</h3>
            <p>
              Varje chip skriver över <em>bara det aktiva spåret</em> med pitch + gate-rad
              för den stilen. Allt annat (tempo, skala, övriga spår) lämnas i fred. Perfekt
              när du vill byta karaktär på ett enskilt spår.
            </p>
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
            <h2>12. Ackord-input & sekvensinspelning</h2>
            <p>Det finns två sätt att mata in toner från ett MIDI-keyboard:</p>

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

            <TipBox>
              Ingen hårdvara? Du kan fortfarande välja MIDI-in i listan — vilket keyboard
              eller pad-controller som helst som webbläsaren ser duger (macOS IAC-buss funkar
              också — skicka från Logic eller annan app).
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
              <kbd>🎹 MIDI</kbd> ger <code>house-jam-1.mid</code>. Importera .mid i Logic på
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
            <h2>16. MIDI ut — styra Logic / hårdvara</h2>
            <p>
              I "MIDI Utgång" väljer du vilken port som tar emot noter. Varje spår skickar
              på sin egen kanal (§5). Velocity, slide, filter-lock osv följer med.
            </p>
            <h3>Logic via IAC-buss (macOS)</h3>
            <ol>
              <li>
                Öppna <strong>Audio MIDI Setup</strong> → dubbelklicka <em>IAC Driver</em>.
              </li>
              <li>
                Kryssa i "Device is online". Lägg till buss "Bus 1".
              </li>
              <li>
                I Logic: skapa en External MIDI eller Software Instrument-track som tar emot
                från IAC Driver Bus 1, kanal 1 (bas), 2 (lead) osv.
              </li>
              <li>
                I UnAnalog: välj "IAC Driver Bus 1" i MIDI Utgång. Klart.
              </li>
            </ol>
            <TipBox>
              Vill du bara ha MIDI och inget ljud från UnAnalog? Stäng av <em>Internt ljud</em>
              {' '}i transport.
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
            <p>
              Slå på <kbd>⏱ Clock ut</kbd> i transport. Ditt instrument/DAW måste vara
              konfigurerat att ta emot extern MIDI-klocka från vald port.
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
            <Example>
              Scenario: Logic kör trummorna och skickar klocka, UnAnalog synkar sin bassline
              och lead ovanpå. Sätt UnAnalogs MIDI ut = IAC Bus 2 så går Logic-trummor in
              separat från UnAnalog-synten.
            </Example>
          </section>

          {/* === 18. TIPS === */}
          <section id="man-tips">
            <h2>18. Tips, idéer och felsökning</h2>
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
                Tryck ▶ Lyssna i UnAnalog <em>före</em> du startar mastern.</dd>
              <dt>Samma hash vid rebuild fast jag ändrat kod</dt>
              <dd>Leta efter gamla <code>.js</code>-filer i <code>src/</code> som skuggar
                dina <code>.tsx</code>. Ta bort dem och bygg om.</dd>
            </dl>
          </section>

          {/* === 19. CREDITS === */}
          <section id="man-credits">
            <h2>19. Credits & copyright</h2>
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

import { useEffect, useRef, type ReactNode } from 'react';
import { APP_META } from '../meta';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Section = { id: string; title: string };

const SECTIONS: Section[] = [
  { id: 'start', title: '1. Snabbstart — första ljudet på 30 sek' },
  { id: 'transport', title: '2. Transport: play, tempo, swing, FILL' },
  { id: 'key', title: '3. Tonart, skala och baseoktav' },
  { id: 'tracks', title: '4. Spår: voices, mute/solo, volym, kanal' },
  { id: 'pitch', title: '5. Pitch-spåret: toner, oktaver, ackord, glid' },
  { id: 'gate', title: '6. Gate-spåret: rytmen och alla per-steg-parametrar' },
  { id: 'tools', title: '7. Verktyg: längder, mutera, euklidisk, rotera, LFO, jitter, humanize' },
  { id: 'styles', title: '8. Stil-presets' },
  { id: 'chord', title: '9. Ackord-input & sekvensinspelning' },
  { id: 'midi-import', title: '10. MIDI-import' },
  { id: 'bank', title: '11. Pattern bank: spara, ladda, exportera' },
  { id: 'song', title: '12. Song chain — kedja patterns' },
  { id: 'midi-out', title: '13. MIDI ut — styra Logic/hårdvara' },
  { id: 'clock', title: '14. MIDI Clock in/ut — synka med annan utrustning' },
  { id: 'tips', title: '15. Tips, idéer och felsökning' },
  { id: 'credits', title: '16. Credits & copyright' },
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
            Klicka bara runt! Inget i manualen är farligt att prova — allt är undo-bart genom
            att byta pattern-slot eller trycka "Rensa gates" / "Slumpa toner".
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

          {/* === 2. TRANSPORT === */}
          <section id="man-transport">
            <h2>2. Transport: play, tempo, swing, FILL</h2>
            <p>Allt som styr själva uppspelningen sitter överst.</p>
            <dl>
              <dt>▶ Spela / ■ Stop</dt>
              <dd>Startar/stoppar Transporten. Kortkommando: ingen tangent — klicket krävs för
                att låsa upp ljudet i webbläsaren.</dd>
              <dt>Klocka: Intern / Extern</dt>
              <dd>Bestämmer vem som är <em>master</em>. Intern = UnAnalog styr tempot. Extern
                = lyssnar på MIDI-klocka från en annan källa (t.ex. Logic). Se §14.</dd>
              <dt>Tempo</dt>
              <dd>40–220 BPM. I externt läge visas uppmätt BPM från master istället.</dd>
              <dt>Swing</dt>
              <dd>Skjuter varannat 16-delssteg framåt. 0% = raka, 50–60% = shuffle.</dd>
              <dt>Internt ljud</dt>
              <dd>Om av, tystas inbyggda ljuden men MIDI fortsätter skickas ut. Praktiskt när
                du spelar Logic via MIDI och inte vill ha dubbelt ljud.</dd>
              <dt>FILL</dt>
              <dd>Aktiverar steg som har villkoret <code>fill</code>. Tryck på 4:an i takten
                för att simulera en Elektron-fill. Se §6.</dd>
              <dt>⏱ Clock ut</dt>
              <dd>Skickar MIDI-klocka (24 PPQ) + Start/Stop till vald MIDI-ut. Syns bara i
                intern-läge.</dd>
            </dl>
            <TipBox>
              Swing låter bra mellan 52–58% på house/hiphop. Över 60% låter det full-on
              swing-jazz.
            </TipBox>
          </section>

          {/* === 3. KEY === */}
          <section id="man-key">
            <h2>3. Tonart, skala och baseoktav</h2>
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
              <dd>Global ton-höjd. Varje spår kan också ha sin egen oktav-shift (§4).</dd>
            </dl>
            <Example>
              Har du en groove i A Minor och vill prova D Phrygian? Ändra bara rot till D och
              skala till Phrygian. Rytmen är densamma, vibben ny.
            </Example>
          </section>

          {/* === 4. TRACKS === */}
          <section id="man-tracks">
            <h2>4. Spår: voices, mute/solo, volym, kanal</h2>
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
                (§6).</dd>
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

          {/* === 5. PITCH === */}
          <section id="man-pitch">
            <h2>5. Pitch-spåret: toner, oktaver, ackord, glid</h2>
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

          {/* === 6. GATE === */}
          <section id="man-gate">
            <h2>6. Gate-spåret: rytmen och alla per-steg-parametrar</h2>
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

          {/* === 7. TOOLS === */}
          <section id="man-tools">
            <h2>7. Verktyg — snabba mönsteroperationer</h2>
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
            </dl>
            <Example>
              Euklidisk 5/16 på hihat + 3/8 på en synt-pluck + 1:or på kick = omedelbar
              polyrytm.
            </Example>
          </section>

          {/* === 8. STYLES === */}
          <section id="man-styles">
            <h2>8. Stil-presets</h2>
            <p>
              Knappar som skriver över aktiva spårets gates + pitch med en typisk rytm/melodi
              för genren. Perfekt startpunkt när du inte vet var du ska börja.
            </p>
            <TipBox>
              Preset ersätter det aktiva spåret helt. Vill du bara prova utan att förlora
              nuvarande? Spara till en tom bank-slot först (§11).
            </TipBox>
          </section>

          {/* === 9. CHORD === */}
          <section id="man-chord">
            <h2>9. Ackord-input & sekvensinspelning</h2>
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

          {/* === 10. MIDI IMPORT === */}
          <section id="man-midi-import">
            <h2>10. MIDI-import</h2>
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

          {/* === 11. BANK === */}
          <section id="man-bank">
            <h2>11. Pattern bank: spara, ladda, exportera</h2>
            <p>
              8 slottar (A–H). Klicka för att byta, dubbelklicka (eller "Rensa") för att
              tömma. Alla slots + bank-inställningar autosparas i webbläsaren.
            </p>
            <dl>
              <dt>Sync-läge</dt>
              <dd><em>Genast</em> hoppar direkt när du byter slot. <em>Nästa takt</em> väntar
                till taktstart — musikaliskt rent.</dd>
              <dt>Exportera</dt>
              <dd>Laddar ner hela banken som JSON. Du kan ange eget filnamn i textrutan, annars
                blir det <code>unanalog-bank-YYYY-MM-DD.json</code>.</dd>
              <dt>Importera</dt>
              <dd>Välj en tidigare exporterad JSON. Gammal bank ersätts.</dd>
            </dl>
            <Example>
              Jobbar du på en låt? Döp exporten till <code>house-jam-1</code> → filen blir
              {' '}<code>house-jam-1.json</code>.
            </Example>
          </section>

          {/* === 12. SONG === */}
          <section id="man-song">
            <h2>12. Song chain — kedja patterns</h2>
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

          {/* === 13. MIDI OUT === */}
          <section id="man-midi-out">
            <h2>13. MIDI ut — styra Logic / hårdvara</h2>
            <p>
              I "MIDI Utgång" väljer du vilken port som tar emot noter. Varje spår skickar
              på sin egen kanal (§4). Velocity, slide, filter-lock osv följer med.
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

          {/* === 14. CLOCK === */}
          <section id="man-clock">
            <h2>14. MIDI Clock in/ut — synka med annan utrustning</h2>
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

          {/* === 15. TIPS === */}
          <section id="man-tips">
            <h2>15. Tips, idéer och felsökning</h2>
            <h3>Kreativa tips</h3>
            <ul>
              <li>Olika pitch- och gate-längd ger polymeter utan extra jobb. Prova 7 vs 16.</li>
              <li>Mutera 25% upprepat = generativ evolution. Spara bra resultat till en slot.</li>
              <li>Kombinera villkor: ett steg med <code>1:3</code> och ett med <code>2:3</code>
                spelar aldrig samtidigt.</li>
              <li>LFO på filter + en lång gate-länd = bubblig acid-textur.</li>
              <li>Lägg tunna ackord på pluck/lead och solo-noter på bass. Det är ofta där
                magin finns.</li>
            </ul>
            <h3>Felsökning</h3>
            <dl>
              <dt>Inget ljud?</dt>
              <dd>Klicka ▶ Spela en gång (webbläsaren kräver user-gesture). Kolla att "Internt
                ljud" är på. Kolla volym på aktiva spåret. Ingen mute?</dd>
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

          {/* === 16. CREDITS === */}
          <section id="man-credits">
            <h2>16. Credits & copyright</h2>
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

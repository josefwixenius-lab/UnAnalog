# UnAnalog Sequencer — Backlog

Framtida idéer i ungefärlig prioriteringsordning. Flytta uppåt/nedåt när prioritet ändras. Komplexitet markeras med t-shirt-storlekar:
**XS** ≈ 30 min, **S** ≈ 1–2 h, **M** ≈ 3–5 h, **L** ≈ 1 dag, **XL** ≈ flera dagar.

---

## 🎯 Nästa upp — top 3 om du vill plocka nåt smått (≈7 h totalt)

Mina rekommendationer i prioordning. Plocka en när det känns rätt; ingen brådska.

1. **EQ per spår** (S, ~1.5 h) — naturliga nästa steg efter FX-paketet. `Tone.EQ3`
   med low-shelf / mid-peak / high-shelf. Synthwave-bas trivs med en boost runt
   80–100 Hz och en notch vid 3 kHz för att inte mosa lead-spåret.

2. **Audio export (.wav)** (S, ~2 h) — bygg klart en låt och spara som ljudfil
   för delning/mastering. `Tone.Offline` gör det relativt smärtfritt — vi
   schedulerar X takter, bouncar offline och triggar en download.

3. **MIDI-CC out per spår** (M, ~4 h) — du har bra hårdvara. Att kunna skicka
   filter-cutoff från UnAnalogs LFO till JT-4000:s expression-input (eller
   Model D / ESI / JV-1010 osv) öppnar riggen på ett helt annat sätt än bara
   noter. Per-spår välj källa (LFO / per-step automation / fast värde) + vilken
   CC + kanal.

---

## 🎯 Synthwave-vägen — KLAR 🎉

Hela 7-stegs-paketet är byggt och pushat:
- ✅ Per-spår pan (Fas 1, commit `13165a5`)
- ✅ Variabel slide-tid per step (Fas 1)
- ✅ Delay-djup: feedback + tid + tape-mode (Fas 2, commit `8674cdb`)
- ✅ Reverb Short/Long sends (Fas 2)
- ✅ Chorus per spår (Fas 2)
- ✅ Bitcrusher per spår (Fas 2)
- ✅ Per-spår filter cutoff + resonans baseline (Fas 3, commit `e0ff6d8`)
- ✅ Sidechain-duck (Fas 4, commit `a86c1b7`)

→ Manual §9 har ett komplett "🌆 Synthwave FX-recept" med 4-spårsuppställning.

---

## 🔥 Quick wins (XS–S, hög effekt per timme)

- [ ] **Reverb-typ: Hall/Plate/Spring/Shimmer** (M, ~3 h) — olika IR per typ. Shimmer är magi för pad
- [ ] **EQ per spår** (S, ~1.5 h) — `Tone.EQ3`, low-shelf / mid-peak / high-shelf
- [ ] **Per-step pan** (S, ~1.5 h) — auto-panning utöver baseline-pan, för rörlig stereo

---

## ⭐ Större men jätteroliga (M, 3–5 h vardera)

- [ ] **Per-spår step-rate** — 1/8, 1/16, 1/32, 1/8T. Riktig polyrytm-frihet (utöver polymeter)
- [ ] **MIDI-CC out per spår** — skicka filter-cutoff från LFO till JT-4000:s expression-pedal-CC. Öppnar enorma möjligheter med din hårdvara
- [ ] **Pattern-morphing A→B** — automatisk crossfade mellan två slots över N takter
- [ ] **A/D/S/R-kontroller per voice** (amp + filter envelope) — basis-synthesis

---

## 🎛 Live-performance (M–L)

- [ ] **Performance macros** — en knob styr cutoff på 3 spår + reverb-wet på pad samtidigt. Stort UX-jobb men fantastiskt live (M+)
- [ ] **MIDI-learn för alla parametrar** — CC från controller → vilken slider som helst (M)
- [ ] **Scene-snapshot + interpolation** — spara FX-mix-state, lerp mellan dem (M)
- [ ] **Conditional pattern-byten** — "byt till slot D efter 16 takter automatiskt" (S–M)

---

## 🛠 Synthesis-djup (S–M)

- [ ] **Per-step pitch-bend** (±1 semitone) — för subtilare fillade leads
- [ ] **Wavetable eller PWM-voice** — bredare ljudpalett
- [ ] **Auto-humanize-makro** — applicera nudge + velocity-jitter i mängd, kalibrerat per genre
- [ ] **Tempomultiplikator per spår** (halftime, doubletime) — kompletterar step-rate

---

## 🌐 MIDI/integration (S–M)

- [ ] **MIDI-thru** — keyboard-in routas live till MIDI-ut (jam mot extern synth utan att gå via inspelning)
- [ ] **Program Change vid pattern-byte** — växla synth-preset automatiskt
- [ ] **MIDI-export förbättring** — flera spår på en gång, custom MIDI-filnamn
- [ ] **Audio export (.wav)** — spela in X takter till fil. `Tone.Offline` finns inbyggt
- [ ] **CV/Gate-export via DC-coupled audio interface** — nördigt men öppnar modulär-anslutning (L)

---

## 🎨 Visualisering (S–M)

- [ ] **Mini-oscilloskop per spår** — visuell feedback i TrackStrip
- [ ] **Spektrumanalysator på master** — kolla nivåerna när du EQ:ar
- [ ] **Step-grid med större zoom** — för långa polymeter-spår
- [ ] **Färgkodning av accents** — tydligare visuell rytm
- [ ] **Dark/light theme-switch**
- [ ] **Mobil/touch-optimering**

---

## 💡 Idéer att överväga (lägre prio eller behöver mognad)

- [ ] Tangentbordsinput för pitch-steg (skriv tonnamn)
- [ ] Längre song chain (mer än 16 steg)
- [ ] Polyrytm-randomizer-knapp (slumpa stegnummer per spår)
- [ ] **Auto-fill / variation** — periodisk variation där en eller två steg ändras automatiskt med en regel ("var 4:e cykel, hoppa till oktaven högre på step 7"). Pyramid kallar det "fill-mode"
- [ ] **Skip steps** — hoppa över specifika steg utan att förkorta loopen (probability=0 funkar redan, men explicit skip-flag vore renare)
- [ ] **Step-låsning av oktav-skift** — per-step oktav-modulation utöver pitch.octaveOffset (för LFO-style automation)
- [ ] **Aux-bus / send** — flera reverb/delay-instanser med olika inställningar (overlap med Short/Long-reverb-iden ovan)

---

## ✅ Avklarade milestones

- ✅ Per-steg parametrar (velocity, probability, villkor, ratchet, accent, filter-lock, nudge)
- ✅ Velocity-jitter + humanize-nudge
- ✅ Polymeter (pitch vs gate olika längd)
- ✅ Euklidisk + LFO + stil-presets
- ✅ Pattern bank + song chain + custom exportnamn
- ✅ Ackord-input + ton-för-ton-inspelning
- ✅ MIDI-import (.mid → aktivt spår)
- ✅ MIDI ut (noter, slide, kanal per spår)
- ✅ MIDI Clock ut + in (master/slave)
- ✅ Inbyggd manual (📖 Manual)
- ✅ GitHub Pages deploy med auto-bygge
- ✅ UI-översyn — färgzoner, kompakt/detaljerat-toggle, gemensam pitch+gate-ram
- ✅ MIDI-export — SMF Type 1, aktiv slot → .mid
- ✅ Tangent-shortcuts — space, 1–8, Q/W, Z/X, Cmd+Z
- ✅ Undo/redo — Cmd+Z / Cmd+Shift+Z, stack per ändring
- ✅ Copy/paste pitch- eller gate-raden mellan spår
- ✅ Master volym + brickwall-limiter
- ✅ Per-spår FX — delay (PingPong), reverb (3.2s), saturation
- ✅ Randomize-knapp (🎲) som genererar nytt pattern utifrån genre
- ✅ Stilpresets: Ambient, Acid, Berlin, IDM, Chillout, 🌆 Synthwave, 🏁 Outrun
- ✅ MIDI-diagnostik (live-LEDs, test-burst, SPP-reset för Behringer/Elektron-master-sync)
- ✅ Per-spår MIDI-port (rutta olika spår till olika hårdvarusynter)
- ✅ Separat Clock-port (LMDrum kan synkas medan JT-4000 får noterna)
- ✅ Loop-rec — jamma in noter live från MIDI-in i aktivt spår, gate-längd från duration
- ✅ Spel-riktning per spår (▶ ◀ ◀▶ 🎲 ➰) — SQ-10/BQ-10-inspirerad
- ✅ Per-spår pan med L/C/R-indikator
- ✅ Variabel slide-tid per step (legato/portamento-mängd)
- ✅ FX-djupet: per-spår delay-instans (mix/tid/feedback/mode med tape-svaj)
- ✅ Reverb Short (~1.2s) + Long (~6.5s) globala instanser med per-spår sends
- ✅ Chorus per spår (synthwave-essentiellt)
- ✅ Bitcrusher per spår (8→2 bit)
- ✅ Per-spår filter cutoff + resonans baseline (LFO+filterLock modulerar runt)
- ✅ Sidechain-duck (trigger-baserad pump, källa+amount+release per spår)
- ✅ Virtuell pianoklaviatur (25/37/49/61 tangenter) med audition + skala-highlight
- ✅ 🥁 Roll/repeat-knapp (håll-att-rulla på aktivt spår, tangent R, 1/64-puls)
- ✅ Mute-grupper A/B/C/D (Transport-toggle + per-spår grp-tagg)
- ✅ Chorus-djup (rate + depth per spår, live-justerbart)
- ✅ Reverb pre-delay per spår (0–150 ms, för båda Short/Long sends)

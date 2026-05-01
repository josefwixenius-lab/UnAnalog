# UnAnalog Sequencer — Backlog

Framtida idéer i ungefärlig prioriteringsordning. Flytta uppåt/nedåt när prioritet ändras. Komplexitet markeras med t-shirt-storlekar:
**XS** ≈ 30 min, **S** ≈ 1–2 h, **M** ≈ 3–5 h, **L** ≈ 1 dag, **XL** ≈ flera dagar.

---

## 🎯 Min rekommendation: synthwave-väg (≈13 h totalt)

Om du vill bygga en synthwave-perfekt setup steg för steg:

1. Per-spår pan (XS, 30 min)
2. Variabel slide-tid per step (S, ~1 h)
3. Delay-feedback + tid per spår (S, ~2 h)
4. Reverb-system med Short/Long send + decay-trim (M, ~3 h)
5. Sidechain-duck (M, ~4 h) — *bass-pump-tricket*
6. Chorus + bitcrusher per spår (S, ~1 h)
7. Per-spår filter cutoff/resonans baseline (S, ~1.5 h)

---

## 🔥 Quick wins (XS–S, hög effekt per timme)

- [ ] **Per-spår pan** (XS, ~30 min) — `Tone.Panner` per spår, slider i TrackStrip. Stereobild direkt
- [ ] **Variabel slide-tid per step** (S, ~1 h) — `slideTime` 0–1 på PitchStep mappar till 0–200 ms portamento. Idag binär flagga
- [ ] **Bitcrusher-FX per spår** (XS, ~30 min) — `Tone.BitCrusher` i FX-chain, fjärde knob bredvid delay/reverb/sat. Glitch-favorit
- [ ] **Filter cutoff + resonans baseline per voice** (S, ~1.5 h) — idag finns bara per-step `filterLock`. Lägg till en "vilo-cutoff" man kan modulera mot
- [ ] **Delay-feedback per spår** (S, ~1 h) — egen delay-instans per spår, slider 0–0.95
- [ ] **Delay-tid per spår** (S, ~1.5 h) — dropdown 1/4, 1/8, 1/8., 1/8T, 1/16, 1/16T, 1/32
- [ ] **Tape-delay-mode** (S, ~1 h) — pitch-svaj på feedback (LFO på delayTime). Fett retro
- [ ] **Reverb pre-delay per spår** (S, ~30 min) — 0–150 ms, finns i Tone redan
- [ ] **EQ per spår** (S, ~1.5 h) — `Tone.EQ3`, low-shelf / mid-peak / high-shelf
- [ ] **Chorus per spår** (S, ~1 h) — synthwave-leads behöver det
- [ ] **Mute-grupper** (S, ~1.5 h) — tagga spår A/B/C/D, fyra knappar i Transport för live-arrangemang
- [ ] **Roll/repeat-knapp** (S, ~1.5 h) — håll inne så aktiva spår spelar 1/32-rolls live (utan att skriva i grid)

---

## ⭐ Större men jätteroliga (M, 3–5 h vardera)

- [ ] **Sidechain-duck** — välj "key track", target dippar volymen vid varje hit. *Det* synthwave-pump-tricket
- [ ] **Per-spår step-rate** — 1/8, 1/16, 1/32, 1/8T. Riktig polyrytm-frihet (utöver polymeter)
- [ ] **Reverb-system uppgraderat** — 2 globala reverbs (Short ~1.5 s, Long ~8 s) + per-spår send till båda + decay-trim. Per-spår reverb är CPU-tungt, detta är smart kompromiss
- [ ] **Reverb-typ: Hall/Plate/Spring/Shimmer** — olika IR per typ. Shimmer (pitch-shift i feedback) är magi för synthwave-pads
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

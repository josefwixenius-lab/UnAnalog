# UnAnalog Sequencer — Backlog

Framtida idéer, i ungefärlig prioriteringsordning. Flytta uppåt/nedåt när prioritet ändras.

## Nu pågår

- 🚧 **UI-översyn** — tydligare global-vs-spår-separation, färgzoner, pitch+gate gemensam ram
- 🚧 **MIDI-export** — SMF Type 1, aktiv slot → .mid

## Högt värde, låg insats

- [ ] ⌨️ **Tangent-shortcuts** — `space` = play/stop, `1–8` = byt slot, `Q/W` = mute/solo aktivt spår, `Z/X` = byt aktivt spår
- [ ] ↩️ **Undo/redo** — `Cmd+Z` / `Cmd+Shift+Z`, stack per pattern-ändring
- [ ] 📋 **Copy/paste pitch- eller gate-raden** mellan spår eller slots
- [ ] 🎚 **Master volym + limiter** så ljudet aldrig clippar

## Medelstort jobb, stort värde

- [ ] 🎛 **Per-spår effekter** — delay, reverb, saturation (Tone.js stödjer allt)
- [ ] 🎲 **"Randomize"-knapp** som gör helt nytt pattern utifrån vald genre/stil
- [ ] 🎶 **Audio export (.wav)** — spela in X takter till fil. `Tone.Offline` finns inbyggt

## Större projekt

- [ ] 🔁 **MIDI CC-automation** — per-steg p-locks för cutoff, resonans, pan, CC1-127
- [ ] 📐 **Euklidisk + rotation per spår samtidigt** (kombinerade rytmer, separata knappar)

## Idéer att överväga

- [ ] Tangentbordsinput för pitch-steg (skriv tonnamn)
- [ ] Envelope (ADSR) per spår
- [ ] Mute groups (ex: kick + alt-kick exklusiva)
- [ ] Tempomultiplikator per spår (halftime, doubletime)
- [ ] Längre song chain (mer än N steg)
- [ ] Dark/light theme-switch
- [ ] Mobil/touch-optimering

## Avklarade milestones

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

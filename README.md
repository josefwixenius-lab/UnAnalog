# UnAnalog Sequencer

En webbaserad step-sequencer inspirerad av Elektron-tänkandet: varje spår har ett separat **pitch-spår** (vilka toner) och **gate-spår** (när de spelas). Olika längder = polymeter. Byggt med React + TypeScript + Tone.js + Web MIDI.

**🔗 Live:** https://josefwixenius-lab.github.io/UnAnalog/

## Funktioner

- 🎹 Pitch- och gate-spår med individuella längder (polymeter)
- 🎛 Per-steg parametrar à la Elektron: gate, ratchet, accent, probability, villkor, velocity, filter-lock, nudge
- 🎵 Scale-aware — byt tonart eller skala när som helst, mönstret följer med
- ⌨️ Klick/drag/tangent-input på pitch-step (skriv "C3" eller "1–7", dra för skalsteg, Shift+dra för kromatisk out-of-scale)
- 🎚 Sex inbyggda voices: Bass, Lead, Pad, Saw, Hats, **PWM** (drömlik puls-bredds-modulation)
- 🌫 Fyra reverb-typer per spår: **Hall / Plate / Spring / Shimmer** (shimmer = +12 pitchshift i feedback-loop)
- 🎼 Ackord-input via MIDI-keyboard (med arp-riktningar)
- 🎹 Ton-för-ton-inspelning (melodier i valfri ordning)
- 🔀 MIDI-import av .mid-filer + MIDI-export med spår-urval
- 🔊 **WAV-export** med full FX-kedja (offline-rendering via Tone.js)
- 🌗 **Pattern-morphing A→B** — interpolera mellan två slots över N takter
- 💾 8 pattern-slots med song chain, autosave i webbläsaren
- 📤 Export/import av hela banken som JSON med valbart filnamn
- 🔌 MIDI ut till Logic / hårdvara, flera kanaler samtidigt
- ⏱ MIDI Clock in & ut — synka med master eller vara master
- 🎨 Stil-presets, euklidiska fördelningar, LFO, humanize-nudge, velocity-jitter

## Kom igång

Kräver **Chrome** (eller annan Chromium-baserad browser) för Web MIDI-stödet.

```bash
npm install
npm run dev      # dev-server på http://localhost:5173
npm run build    # production-build till dist/
npm run preview  # kör bygget lokalt
```

## Deploy

Pushar du till `main` bygger och deployar GitHub Actions automatiskt till GitHub Pages. Inga manuella steg.

Om du forkar eller flyttar repot till annat namn — uppdatera `base` i `vite.config.ts` så den matchar repo-namnet (t.ex. `base: '/MittRepo/'`).

## Tips för Logic Pro (macOS)

1. Öppna **Audio MIDI Setup** → dubbelklicka IAC Driver → "Device is online", lägg till Bus 1.
2. I UnAnalog: välj "IAC Driver Bus 1" i MIDI Utgång.
3. I Logic: skapa Software Instrument-spår som tar emot från IAC Driver, kanal 1, 2, 3… — en per spår i UnAnalog.
4. Stäng av "Internt ljud" i UnAnalog om du bara vill ha Logic-ljudet.

## Licens

© 2026 Josef Wixenius. Alla rättigheter förbehållna.

Byggd för hobby och kul. Ändra `src/meta.ts` om du forkar till eget bruk.

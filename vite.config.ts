import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build-stämpel injekteras vid bygg-tid så footer kan visa exakt vilken
// bundle som körs. Hjälper när man vill verifiera att senaste fixarna
// faktiskt nått browsern (browser-cache är aggressiv på Pages).
const BUILD_STAMP = new Date()
  .toISOString()
  .replace(/T/, ' ')
  .slice(0, 16);

// GitHub Pages serverar från /UnAnalog/, så vi måste sätta base.
// För lokal dev-server ignoreras detta (base påverkar bara build).
export default defineConfig({
  base: '/UnAnalog/',
  plugins: [react()],
  server: { port: 5173 },
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_STAMP),
  },
});

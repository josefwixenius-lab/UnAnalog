import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serverar från /UnAnalog/, så vi måste sätta base.
// För lokal dev-server ignoreras detta (base påverkar bara build).
export default defineConfig({
  base: '/UnAnalog/',
  plugins: [react()],
  server: { port: 5173 },
});

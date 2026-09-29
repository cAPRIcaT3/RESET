import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative URLs work on both username.github.io and repository Pages URLs.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { watch: { ignored: ['**/renders/**', '**/blender/**', '**/handoff/**', '**/test-results/**'] } },
  build: { target: 'es2022' },
});

/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Esquemas Zod compartidos con el backend (design.md §2).
    alias: { '@shared': fileURLToPath(new URL('../backend/src/shared', import.meta.url)) },
    dedupe: ['zod'],
  },
  server: { port: 5173, strictPort: true },
  build: { sourcemap: false, target: 'es2022' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ['phaser'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

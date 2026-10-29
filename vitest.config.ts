import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: { ENLACES_SECRETO: 'secreto-de-prueba' },
  },
});

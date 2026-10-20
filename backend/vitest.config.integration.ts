import { defineConfig } from 'vitest/config';

// Tests de integración: necesitan Postgres con las migraciones aplicadas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    // Comparten la misma base: se ejecutan uno tras otro, no en paralelo.
    fileParallelism: false,
  },
});

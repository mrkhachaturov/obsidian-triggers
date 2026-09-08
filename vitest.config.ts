import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/* `obsidian` has no runtime outside the app, so tests resolve it to a stub -
   one stub for the suite, the way Notebook Navigator does it. */
export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL('./tests/stubs/obsidian.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

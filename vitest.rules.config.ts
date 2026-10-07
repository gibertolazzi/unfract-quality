import { defineConfig } from 'vitest/config';

// Test delle regole di Firestore e Storage. Girano dentro
// `firebase emulators:exec` (vedi `npm run test:rules`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

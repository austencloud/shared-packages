import { defineConfig } from 'vitest/config';

// Node-only unit tests for the package's pure logic (hover-intent timers,
// pin-state persistence). Component behavior is verified by svelte-check, the
// publint/attw build gate, the dev harness, and the downstream app integration
// pass — the monorepo has no browser-test harness and this package does not add
// one (see component-test-discipline: don't widen an infra door just to open it).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

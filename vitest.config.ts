import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@responsivevoice/features',
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
  },
});

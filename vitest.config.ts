import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['__tests__/setup.ts'],
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '.next/**'],
    alias: {
      '@': path.resolve(__dirname),
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.d.ts',
        'types/'
      ]
    }
  }
});

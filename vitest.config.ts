import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Component tests under __tests__/ render React and need a DOM; the
    // node environment they previously ran under could not mount anything.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // #122: Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '*.config.ts',
        '*.config.js',
        'vitest.setup.ts',
        '**/*.d.ts',
      ],
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})

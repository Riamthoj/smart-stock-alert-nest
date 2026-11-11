import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest: native ESM + TypeScript (NestJS 12 is ESM-only).
 * SWC compiles the sources so decorator metadata (emitDecoratorMetadata)
 * is available, which Nest dependency injection needs in e2e tests.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});

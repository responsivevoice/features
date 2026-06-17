import { defineConfig } from 'tsdown';
import { bannerFor } from './banner.ts';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  target: 'node14',
  banner: bannerFor(import.meta.url),
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  noExternal: [/.*/], // Bundle all dependencies for GitHub Actions
  // No shebang - GitHub Actions loads this as a module, not a CLI script
  // CLI usage: node dist/index.cjs or via npm scripts
});

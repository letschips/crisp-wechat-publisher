import esbuild from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('.test-dist', { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['tests/*.test.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  outdir: '.test-dist',
  outExtension: { '.js': '.cjs' },
  sourcemap: 'inline',
  alias: {
    obsidian: './tests/obsidian-stub.ts',
  },
});

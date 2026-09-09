import { builtinModules } from 'node:module';
import process from 'node:process';
import esbuild from 'esbuild';

const production = process.argv[2] === 'production';

/* Obsidian loads main.js from the plugin folder, so the bundle lands in the repo
   root next to manifest.json - that pair is what gets installed. */
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((n) => `node:${n}`)],
  format: 'cjs',
  target: 'es2020',
  /* The When editor is a Preact island; everything else is declared. */
/* JSX goes through `preact/compat`, not bare Preact: dnd-kit reads
     `event.nativeEvent` in its sensors, and that field exists only on events
     compat normalises. With the bare runtime the handler receives a plain DOM
     event, `nativeEvent` is undefined, and a drag never starts. */
  jsx: 'automatic',
  jsxImportSource: 'preact/compat',
  /* React libraries resolve to compat, the way Preact's own build does it: the
     JSX runtime a React library asks for is compat's, not Preact's own, or its
     elements miss the semantics those libraries expect. `react` itself is
     installed as `@preact/compat`, so the bundle carries one implementation. */
  alias: {
    'react/jsx-runtime': 'preact/compat/jsx-runtime',
    'react/jsx-dev-runtime': 'preact/compat/jsx-dev-runtime',
  },
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  minify: production,
  outfile: 'main.js',
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}

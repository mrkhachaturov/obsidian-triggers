/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const repository = process.cwd();
const temporary: string[] = [];

async function write(root: string, name: string, contents: string) {
  const destination = path.join(root, name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

async function fixture(script: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'triggers-gates-'));
  temporary.push(root);
  await mkdir(path.join(root, 'scripts'));
  await copyFile(path.join(repository, 'scripts', script), path.join(root, 'scripts', script));
  return root;
}

function run(root: string, script: string) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  return result;
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('translation gate', () => {
  async function stringsFixture(english: string, source: string, russian = english) {
    const root = await fixture('check-strings.mjs');
    await mkdir(path.join(root, 'node_modules'));
    await symlink(
      path.join(repository, 'node_modules/typescript'),
      path.join(root, 'node_modules/typescript'),
    );
    await write(root, 'src/i18n/locales/en.ts', `export const en = ${english} as const;`);
    await write(root, 'src/i18n/locales/ru.ts', `export const ru = ${russian};`);
    await write(root, 'src/ui/nested/editor.tsx', source);
    return root;
  }

  it('counts TSX reads, string methods, dynamic branches and registered paths', async () => {
    const root = await stringsFixture(
      "{ title: 'Title', greeting: 'Hello {name}', modes: { all: 'All', any: 'Any' }, action: 'Run' }",
      `const view = <div>{strings.title}{strings.greeting.replace('{name}', name)}{strings.modes[key]}</div>;
       const registered = 'action';`,
    );
    const result = run(root, 'check-strings.mjs');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('5 keys, all read, every locale matches');
  });

  it('rejects unused keys even when a locale references its own strings', async () => {
    const root = await stringsFixture(
      "{ used: 'Yes', dead: 'No' }",
      'const view = <div>{strings.used}</div>;',
    );
    await write(
      root,
      'src/i18n/locales/ru.ts',
      "export const ru = { used: 'Да', dead: 'Нет' }; strings.dead;",
    );
    const result = run(root, 'check-strings.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Declared in en.ts and read nowhere (1):\n  dead');
  });

  it('reports undeclared source reads and both directions of locale drift', async () => {
    const root = await stringsFixture(
      "{ known: 'Yes' }",
      'const view = <div>{strings.known}{strings.missing}</div>;',
      "{ obsolete: 'Old' }",
    );
    const result = run(root, 'check-strings.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Read from the source and absent in en.ts (1):\n  missing');
    expect(result.stderr).toContain('ru.ts is missing (1):\n  known');
    expect(result.stderr).toContain('ru.ts has keys English does not (1):\n  obsolete');
  });
});

describe('stylesheet gate', () => {
  it('reads nested TSX classes without treating custom properties as classes', async () => {
    const root = await fixture('check-styles.mjs');
    await write(
      root,
      'src/ui/nested/editor.tsx',
      'const view = <div className="tr-row" style={{ "--tr-depth": 1 }} />;',
    );
    await write(root, 'styles.css', '.container .tr-row { padding: calc(var(--tr-depth) * 1px); }');
    expect(run(root, 'check-styles.mjs').status).toBe(0);
  });

  it('reports unstyled source classes and abandoned stylesheet rules together', async () => {
    const root = await fixture('check-styles.mjs');
    await write(root, 'src/editor.tsx', 'const view = <div className="tr-current" />;');
    await write(root, 'styles.css', '.tr-abandoned { color: red; }');
    const result = run(root, 'check-styles.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Written in src and styled nowhere (1):\n  .tr-current');
    expect(result.stderr).toContain(
      'Styled in styles.css and written nowhere (1):\n  .tr-abandoned',
    );
  });

  it.each(['source', 'stylesheet'])('fails closed if the %s contains no classes', async (empty) => {
    const root = await fixture('check-styles.mjs');
    await write(root, 'src/editor.ts', empty === 'source' ? '' : 'const cls = "tr-row";');
    await write(root, 'styles.css', empty === 'stylesheet' ? '' : '.tr-row {}');
    const result = run(root, 'check-styles.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Read no classes from one side');
  });
});

describe('dependency patch installer', () => {
  async function patchFixture(version = '0.5.0') {
    const root = await fixture('patch-dependencies.mjs');
    await write(root, 'node_modules/@dnd-kit/dom/package.json', JSON.stringify({ version }));
    await mkdir(path.join(root, 'patches'));
    await copyFile(
      path.join(repository, 'patches/dnd-kit-dom-0.5.0.patch'),
      path.join(root, 'patches/dnd-kit-dom-0.5.0.patch'),
    );
    for (const extension of ['js', 'cjs']) {
      const prefix = extension === 'cjs' ? 'utilities.' : '';
      await write(
        root,
        `node_modules/@dnd-kit/dom/index.${extension}`,
        `${'\n'.repeat(extension === 'cjs' ? 2012 : 2011)}    controller.signal.onabort = () => this.handleCancel(event);
    controller.onEvent(event);
    this.controller = controller;
    const documents = ${prefix}getDocuments();
    const unbindListeners = this.listeners.bind(documents, [
      {
        type: "pointermove",
`,
      );
    }
    return root;
  }

  it('patches both module formats and leaves a second install byte-identical', async () => {
    const root = await patchFixture();
    expect(run(root, 'patch-dependencies.mjs').status).toBe(0);
    const snapshots = [];
    for (const extension of ['js', 'cjs']) {
      const content = await readFile(
        path.join(root, `node_modules/@dnd-kit/dom/index.${extension}`),
        'utf8',
      );
      const prefix = extension === 'cjs' ? 'utilities.' : '';
      expect(content).toContain(`${prefix}getDocuments(${prefix}getDocument(source.element))`);
      snapshots.push(content);
    }
    expect(run(root, 'patch-dependencies.mjs').status).toBe(0);
    expect(await readFile(path.join(root, 'node_modules/@dnd-kit/dom/index.js'), 'utf8')).toBe(
      snapshots[0],
    );
    expect(await readFile(path.join(root, 'node_modules/@dnd-kit/dom/index.cjs'), 'utf8')).toBe(
      snapshots[1],
    );
  });

  it('refuses another dependency version before modifying either module', async () => {
    const root = await patchFixture('0.6.0');
    const files = ['js', 'cjs'].map((extension) =>
      path.join(root, `node_modules/@dnd-kit/dom/index.${extension}`),
    );
    const before = await Promise.all(files.map((file) => readFile(file, 'utf8')));
    const result = run(root, 'patch-dependencies.mjs');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Review the dnd-kit popout patch');
    expect(await Promise.all(files.map((file) => readFile(file, 'utf8')))).toEqual(before);
  });

  it('refuses changed upstream context without partially patching the other module', async () => {
    const root = await patchFixture();
    await write(root, 'node_modules/@dnd-kit/dom/index.cjs', 'changed upstream implementation\n');
    const file = path.join(root, 'node_modules/@dnd-kit/dom/index.js');
    const before = await readFile(file, 'utf8');
    expect(run(root, 'patch-dependencies.mjs').status).toBe(1);
    expect(await readFile(file, 'utf8')).toBe(before);
    expect(await readFile(path.join(root, 'node_modules/@dnd-kit/dom/index.cjs'), 'utf8')).toBe(
      'changed upstream implementation\n',
    );
  });
});

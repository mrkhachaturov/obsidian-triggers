#!/usr/bin/env node
/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 *
 * Two gates over the dictionaries, both failures a build must not survive:
 *
 *   1. A key English declares that nothing reads. A dead string is translated
 *      into every language forever and shown nowhere.
 *   2. A locale whose shape has drifted from English. The type checker catches a
 *      missing key; it does not catch one that was added and never translated,
 *      nor a stale key left behind after English dropped it.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src', 'i18n', 'locales');
const srcDir = path.join(root, 'src');

/** Every leaf path in an object literal, as `a.b.c`. */
function keysOf(node, prefix, out) {
  if (!ts.isObjectLiteralExpression(node)) return out;

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) continue;

    const key = prefix === '' ? name.text : `${prefix}.${name.text}`;
    if (ts.isObjectLiteralExpression(property.initializer)) keysOf(property.initializer, key, out);
    else out.add(key);
  }
  return out;
}

async function readLocale(file) {
  const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const keys = new Set();

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
      const initializer = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      keysOf(initializer, '', keys);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return keys;
}

async function sourceFiles(dir) {
  const found = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(full)));
    /* `.tsx` as well: the When editor is a component, and its strings are read
       there like anywhere else. */
    else if (/\.tsx?$/.test(entry.name) && !full.startsWith(localesDir)) found.push(full);
  }
  return found;
}

/** Key paths reached through the exported `strings` object. */
async function usedKeys(known) {
  const used = new Set();

  for (const file of await sourceFiles(srcDir)) {
    const source = ts.createSourceFile(file, await fs.readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);

    const visit = (node) => {
      /* Only the outermost access is a key: `strings.a.b` contains `strings.a`,
       * which is a branch and not a string anyone reads. */
      const outermost = ts.isPropertyAccessExpression(node) && !ts.isPropertyAccessExpression(node.parent);

      if (outermost) {
        const parts = [];
        let current = node;
        while (ts.isPropertyAccessExpression(current)) {
          parts.unshift(current.name.text);
          current = current.expression;
        }

        if (ts.isIdentifier(current) && current.text === 'strings') {
          /* `strings.a.b.replace(...)` reads `strings.a.b`; the call is a method
           * on the string, not another key. */
          const called = ts.isCallExpression(node.parent) && node.parent.expression === node;
          if (called) parts.pop();

          const path = parts.join('.');

          /* `strings.a[key]` picks one of a branch's leaves at runtime, and which
           * one is not knowable here. All of them count as read. */
          if (ts.isElementAccessExpression(node.parent) && node.parent.expression === node) {
            for (const key of known) if (key.startsWith(`${path}.`)) used.add(key);
          } else if (parts.length > 0) {
            used.add(path);
          }
        }
      }
      /* A registry names its strings by path, so a literal that is a key counts
       * as reading it. A literal that is not a key is just a string. */
      if (ts.isStringLiteral(node) && known.has(node.text)) used.add(node.text);

      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return used;
}

function report(title, items) {
  console.error(`\n${title}`);
  for (const item of items) console.error(`  ${item}`);
}

async function main() {
  const english = await readLocale(path.join(localesDir, 'en.ts'));
  const used = await usedKeys(english);

  const problems = [];

  const unused = [...english].filter((key) => !used.has(key)).sort();
  if (unused.length > 0) {
    report(`Declared in en.ts and read nowhere (${unused.length}):`, unused);
    problems.push('unused');
  }

  const missingFromEnglish = [...used].filter((key) => !english.has(key)).sort();
  if (missingFromEnglish.length > 0) {
    report(`Read from the source and absent in en.ts (${missingFromEnglish.length}):`, missingFromEnglish);
    problems.push('undeclared');
  }

  for (const file of await fs.readdir(localesDir)) {
    if (file === 'en.ts' || !file.endsWith('.ts')) continue;

    const locale = await readLocale(path.join(localesDir, file));
    const missing = [...english].filter((key) => !locale.has(key)).sort();
    const extra = [...locale].filter((key) => !english.has(key)).sort();

    if (missing.length > 0) {
      report(`${file} is missing (${missing.length}):`, missing);
      problems.push(file);
    }
    if (extra.length > 0) {
      report(`${file} has keys English does not (${extra.length}):`, extra);
      problems.push(file);
    }
  }

  if (problems.length > 0) {
    console.error('');
    process.exit(1);
  }

  console.log(`Strings: ${english.size} keys, all read, every locale matches.`);
}

await main();

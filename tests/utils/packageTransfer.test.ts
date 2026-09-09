/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import type { ViewRules } from '../../src/types/rule';
import { analyse, apply, write } from '../../src/utils/packageTransfer';
import { makeRule, makeView } from '../factories';

describe('write', () => {
  it('carries a version, so a newer package can be refused rather than half-read', () => {
    const packaged: unknown = JSON.parse(
      write([makeView('markdown', [makeRule({ name: 'Kept' })])], '0.0.1'),
    );

    expect(packaged).toMatchObject({
      schemaVersion: 1,
      pluginVersion: '0.0.1',
      views: [{ viewType: 'markdown', rules: [{ name: 'Kept' }] }],
    });
  });

  it('round-trips through analyse', () => {
    const result = analyse(
      write([makeView('markdown', [makeRule({ name: 'Kept' })])], '0.0.1'),
      [],
    );

    if (typeof result === 'string') throw new Error(result);
    expect(result.views[0]?.rules[0]?.name).toBe('Kept');
  });
});

describe('analyse', () => {
  it('counts how many of the views are already here', () => {
    const here = [makeView('markdown')];
    const result = analyse(write([makeView('markdown'), makeView('bases')], '0.0.1'), here);

    if (typeof result === 'string') throw new Error(result);
    expect(result.views).toHaveLength(2);
    expect(result.known).toBe(1);
  });

  it('refuses a package written by a later version', () => {
    expect(analyse(JSON.stringify({ schemaVersion: 99, views: [] }), [])).toBe('newer');
  });

  it('refuses something that is not a package', () => {
    expect(analyse('not json', [])).toBe('unreadable');
    expect(analyse('"a string"', [])).toBe('unreadable');
    expect(analyse(JSON.stringify({ views: [] }), [])).toBe('empty');
  });

  it('reports entries it had to drop', () => {
    const result = analyse(
      JSON.stringify({ views: [null, { viewType: 'markdown', rules: [] }] }),
      [],
    );

    if (typeof result === 'string') throw new Error(result);
    expect(result.views).toHaveLength(1);
    expect(result.unreadable).toBe(1);
  });
});

describe('apply', () => {
  const here: ViewRules[] = [makeView('markdown', [makeRule({ id: 'a', name: 'Here' })])];

  it('adds a view the vault does not have', () => {
    const result = apply(here, [makeView('bases')], 'replace');

    expect(result.added).toBe(1);
    expect(result.views).toHaveLength(2);
  });

  /* Exporting and importing your own rules must change nothing. */
  it('replaces in place, leaving the count alone', () => {
    const result = apply(
      here,
      [makeView('markdown', [makeRule({ id: 'a', name: 'Renamed' })])],
      'replace',
    );

    expect(result).toMatchObject({ added: 0, replaced: 1 });
    expect(result.views).toHaveLength(1);
    expect(result.views[0]?.rules[0]?.name).toBe('Renamed');
  });

  it('leaves the stored view alone when told to skip', () => {
    const result = apply(
      here,
      [makeView('markdown', [makeRule({ id: 'a', name: 'Renamed' })])],
      'skip',
    );

    expect(result).toMatchObject({ skipped: 1, replaced: 0 });
    expect(result.views[0]?.rules[0]?.name).toBe('Here');
  });

  /* A rule arriving beside one already there has to be a different thing, or
   * editing one edits both. */
  it('adds their rules under the ones already here, with new ids', () => {
    const result = apply(
      here,
      [makeView('markdown', [makeRule({ id: 'a', name: 'Theirs' })])],
      'merge',
    );

    expect(result.merged).toBe(1);
    const rules = result.views[0]?.rules ?? [];
    expect(rules.map((rule) => rule.name)).toEqual(['Here', 'Theirs']);
    expect(rules[1]?.id).not.toBe('a');
  });
});

describe('expression package round trip', () => {
  it('preserves mixed links, parentheses and negation', () => {
    const views = [
      makeView('markdown', [
        makeRule({
          when: {
            kind: 'group',
            children: [
              { field: 'path', op: 'contains', value: 'A' },
              {
                kind: 'group',
                join: 'or',
                negated: true,
                children: [
                  { field: 'path', op: 'contains', value: 'B' },
                  { field: 'path', op: 'contains', value: 'C' },
                ],
              },
            ],
          },
        }),
      ]),
    ];
    const result = analyse(write(views, '0.0.1'), []);
    expect(result).toMatchObject({ views, unreadable: 0 });
  });
});

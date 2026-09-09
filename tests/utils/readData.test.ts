/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { readViews } from '../../src/utils/readData';

/* data.json is untrusted: hand edits, truncated writes, half-merged sync. Each
 * case below is a shape a real file has been found in. */

describe('readViews', () => {
  it('reads a rule and fills what the file left out', () => {
    const { views, skipped } = readViews([{ viewType: 'markdown', rules: [{ name: 'Kanban' }] }]);

    expect(skipped).toBe(0);
    const rule = views[0]?.rules[0];
    if (rule === undefined) throw new Error('expected a rule');

    expect(rule.name).toBe('Kanban');
    expect(rule.enabled).toBe(true);
    expect(rule.stop).toBe(false);
    expect(rule.trigger).toEqual({ kind: 'context' });
    expect(rule.steps).toEqual([]);
    expect(rule.id).not.toBe('');
  });

  it('skips a view with no view type: it is not a chain anything can walk', () => {
    const { views, skipped } = readViews([
      null,
      'nonsense',
      { rules: [] },
      { viewType: '' },
      { viewType: 'bases' },
    ]);

    expect(views).toHaveLength(1);
    expect(skipped).toBe(4);
  });

  it('keeps the readable rules of a view and counts the holes', () => {
    const { views, skipped } = readViews([
      { viewType: 'markdown', rules: [null, { name: 'Kept' }, 42] },
    ]);

    expect(views[0]?.rules).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it('drops an action it cannot identify and keeps the rest of the rule', () => {
    const { views } = readViews([
      {
        viewType: 'markdown',
        rules: [
          {
            name: 'Mixed',
            steps: [
              { kind: 'command', commandId: 'app:go-back' },
              { kind: 'command' },
              null,
              { kind: 'unknown' },
            ],
          },
        ],
      },
    ]);

    expect(views[0]?.rules[0]?.steps).toEqual([{ kind: 'command', commandId: 'app:go-back' }]);
  });

  // An invalid expression must never become an unconditional rule.
  it('rejects a present condition with the wrong shape', () => {
    const { views } = readViews([{ viewType: 'markdown', rules: [{ when: 'nonsense' }] }]);

    const rule = views[0]?.rules[0];
    expect(rule).toBeUndefined();
  });

  /* A row naming a field or an operator this build does not have cannot be
   * evaluated, and keeping it would mean a rule that means something other than
   * what it says. */
  // Dropping an operand changes the truth table, so reject the containing rule.
  it('rejects a rule with a condition it cannot evaluate', () => {
    const { views } = readViews([
      {
        viewType: 'markdown',
        rules: [
          {
            when: {
              kind: 'group',
              children: [
                { field: 'path', op: 'inFolder', value: 'Atlas' },
                { field: 'nonsense', op: 'is', value: 'x' },
                { field: 'path', op: 'soundsLike', value: 'x' },
                { field: 'property', op: 'is', value: 'x' },
                null,
              ],
            },
          },
        ],
      },
    ]);

    const when = views[0]?.rules[0]?.when;
    expect(when).toBeUndefined();
  });

  it('drops the value of an operator that takes none', () => {
    const { views } = readViews([
      {
        viewType: 'markdown',
        rules: [
          {
            when: {
              kind: 'group',
              children: [{ field: 'property', key: 'due', op: 'missing', value: 'stale' }],
            },
          },
        ],
      },
    ]);

    expect(views[0]?.rules[0]?.when.children[0]).toEqual({
      field: 'property',
      key: 'due',
      op: 'missing',
      value: '',
    });
  });

  /* data.json is hand-edited and half-merged by sync: a tree must not be able to
   * recurse until the stack ends. */
  it('stops reading a tree deeper than the cap', () => {
    const deep = (left: number): unknown =>
      left === 0
        ? { field: 'path', op: 'contains', value: 'x' }
        : { kind: 'group', children: [deep(left - 1)] };

    const { views } = readViews([{ viewType: 'markdown', rules: [{ when: deep(12) }] }]);

    // Truncating a deep tree could turn a restrictive rule into an empty match.
    expect(views[0]?.rules).toEqual([]);

    // The control: the same shape within the cap is read, so it is the depth
    // that rejected the tree above and not the shape.
    const shallow = readViews([{ viewType: 'markdown', rules: [{ when: deep(2) }] }]);
    expect(shallow.views[0]?.rules).toHaveLength(1);
  });

  it('reads nothing out of something that is not a list', () => {
    expect(readViews(null)).toEqual({ views: [], skipped: 0 });
    expect(readViews({ views: [] })).toEqual({ views: [], skipped: 0 });
  });
});

describe('current expression parsing', () => {
  it('normalizes defaults and removes the first incoming connector', () => {
    const result = readViews([
      {
        viewType: 'markdown',
        rules: [
          {
            when: {
              kind: 'group',
              negated: false,
              children: [
                { field: 'path', op: 'is', value: 'A', join: 'or', negated: false },
                { field: 'path', op: 'is', value: 'B', join: 'and', negated: true },
              ],
            },
          },
        ],
      },
    ]);
    expect(result.views[0]?.rules[0]?.when).toEqual({
      kind: 'group',
      children: [
        { field: 'path', op: 'is', value: 'A' },
        { field: 'path', op: 'is', value: 'B', negated: true },
      ],
    });
  });

  it.each([
    null,
    { kind: 'group', children: null },
    { kind: 'group', children: [null] },
    { kind: 'group', children: [{ field: 'path', op: 'is', value: 'A', join: 'xor' }] },
  ])('rejects a malformed present expression: %j', (when) => {
    const result = readViews([{ viewType: 'markdown', rules: [{ when }] }]);
    expect(result.skipped).toBe(1);
    expect(result.views[0]?.rules).toEqual([]);
  });
});

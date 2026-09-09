/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Filter, isGroup, MAX_DEPTH, type ViewRules } from '../../src/types/rule';
import { readViews } from '../../src/utils/readData';

/* `data.json` is edited by hand, merged by sync services and truncated by
 * crashes, so the parser's contract is total: any value in, rules the rest of
 * the plugin can run out.
 *
 * Generated as valid rules with one field replaced or removed, rather than as
 * random values: random values are rejected at the first field and never reach
 * the branches worth testing. Measured on the sibling plugin, a purely random
 * generator produced a readable entry in 7 runs out of 1000. */

const broken = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.double(),
  fc.string({ maxLength: 6 }),
  fc.array(fc.anything(), { maxLength: 2 }),
  fc.dictionary(fc.string({ maxLength: 4 }), fc.anything(), { maxKeys: 2 }),
);

/** The same value with one key replaced by something else, or dropped. */
function damaged<T extends Record<string, unknown>>(
  arbitrary: fc.Arbitrary<T>,
): fc.Arbitrary<unknown> {
  return fc
    .tuple(arbitrary, fc.nat(), fc.oneof(broken, fc.constant(undefined)))
    .map(([value, index, replacement]) => {
      const keys = Object.keys(value);
      if (keys.length === 0) return value;
      const key = keys[index % keys.length] as string;
      const copy: Record<string, unknown> = { ...value };
      if (replacement === undefined) delete copy[key];
      else copy[key] = replacement;
      return copy;
    });
}

const identifier = fc.constantFrom('a', 'b', 'c');
const text = fc.constantFrom('Atlas', 'daily/2026-01-01.md', '/\\d{4}/', '');

const test = fc.oneof(
  fc.record(
    {
      field: fc.constant('path'),
      op: fc.constantFrom('is', 'contains', 'notContains', 'inFolder', 'notInFolder'),
      value: text,
      join: fc.constantFrom('and', 'or'),
      negated: fc.constant(true),
    },
    { requiredKeys: ['field', 'op', 'value'] },
  ),
  fc.record(
    {
      field: fc.constant('viewName'),
      op: fc.constantFrom('is', 'contains', 'startsWith'),
      value: fc.constantFrom('Kanban Board', 'Table'),
      join: fc.constantFrom('and', 'or'),
    },
    { requiredKeys: ['field', 'op', 'value'] },
  ),
  fc.record(
    {
      field: fc.constant('property'),
      key: fc.constantFrom('type', 'due', 'tags'),
      op: fc.constantFrom('is', 'exists', 'missing', 'empty', 'contains'),
      value: text,
      join: fc.constantFrom('and', 'or'),
    },
    { requiredKeys: ['field', 'key', 'op', 'value'] },
  ),
);

/** A tree that sometimes goes past the cap, which is the branch worth reaching. */
const filter: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.oneof(
    { arbitrary: test, weight: 5 },
    { arbitrary: damaged(test as fc.Arbitrary<Record<string, unknown>>), weight: 3 },
    {
      arbitrary: fc.record(
        {
          kind: fc.constant('group'),
          children: fc.array(tie('node'), { maxLength: 3 }),
          join: fc.constantFrom('and', 'or'),
          negated: fc.constant(true),
        },
        { requiredKeys: ['kind', 'children'] },
      ),
      weight: 3,
    },
    { arbitrary: broken, weight: 1 },
  ),
})).node;

const rule = fc.record(
  {
    id: identifier,
    name: fc.string({ maxLength: 8 }),
    enabled: fc.boolean(),
    trigger: fc.record({ kind: fc.constant('context') }),
    when: fc.record(
      { kind: fc.constant('group'), children: fc.array(filter, { maxLength: 3 }) },
      { requiredKeys: ['kind', 'children'] },
    ),
    steps: fc.array(
      fc.oneof(
        fc.record({
          kind: fc.constant('command'),
          commandId: fc.constantFrom('app:open-settings'),
        }),
        fc.record({
          kind: fc.constant('quickadd'),
          choiceId: identifier,
          choiceName: fc.constantFrom('Capture'),
        }),
      ),
      { maxLength: 2 },
    ),
    stop: fc.boolean(),
  },
  { requiredKeys: ['id', 'when', 'steps'] },
);

const view = fc.record(
  {
    id: identifier,
    viewType: fc.constantFrom('markdown', 'bases', 'canvas', 'excalidraw'),
    rules: fc.array(
      fc.oneof(
        { arbitrary: rule, weight: 6 },
        { arbitrary: damaged(rule as fc.Arbitrary<Record<string, unknown>>), weight: 4 },
        { arbitrary: broken, weight: 1 },
      ),
      { maxLength: 3 },
    ),
  },
  { requiredKeys: ['viewType', 'rules'] },
);

const stored = fc.oneof(
  { arbitrary: fc.array(view, { maxLength: 3 }), weight: 6 },
  { arbitrary: fc.array(fc.oneof(damaged(view), broken), { maxLength: 3 }), weight: 3 },
  { arbitrary: fc.anything(), weight: 1 },
);

function depthOf(node: Filter, depth = 0): number {
  if (!isGroup(node)) return depth;
  return node.children.reduce(
    (deepest, child) => Math.max(deepest, depthOf(child, depth + 1)),
    depth,
  );
}

/** Everything the runner is allowed to assume about the rules it walks. */
function checkViews(views: readonly ViewRules[]): void {
  const seenViews = new Set<string>();
  for (const view of views) {
    expect(view.viewType.length).toBeGreaterThan(0);
    expect(view.id.length).toBeGreaterThan(0);
    expect(seenViews.has(view.viewType)).toBe(false);
    seenViews.add(view.viewType);

    const seenRules = new Set<string>();
    for (const rule of view.rules) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(seenRules.has(rule.id)).toBe(false);
      seenRules.add(rule.id);
      expect(typeof rule.name).toBe('string');
      expect(typeof rule.enabled).toBe('boolean');
      expect(typeof rule.stop).toBe('boolean');
      expect(rule.when.kind).toBe('group');
      expect(depthOf(rule.when)).toBeLessThanOrEqual(MAX_DEPTH);
      for (const step of rule.steps) {
        if (step.kind === 'command') expect(step.commandId.length).toBeGreaterThan(0);
        else expect(step.choiceId.length).toBeGreaterThan(0);
      }
    }
  }
}

describe('reading stored rules', () => {
  it('answers with rules the runner can walk, whatever the file holds', () => {
    fc.assert(
      fc.property(stored, (raw) => {
        checkViews(readViews(raw).views);
      }),
      { numRuns: 1000 },
    );
  });

  it('reads back what it would write, unchanged', () => {
    fc.assert(
      fc.property(stored, (raw) => {
        const once = readViews(raw).views;
        /* The store saves these, so parsing them again has to be a fixed point -
         * otherwise an ordinary save would keep rewriting the user's file. */
        expect(readViews(JSON.parse(JSON.stringify(once))).views).toEqual(once);
      }),
      { numRuns: 1000 },
    );
  });

  /* The control for the two properties above: an empty run and a run that never
   * built a rule look identical from the outside. */
  it('generates rules that reach the parser, not only rules it rejects', () => {
    const reached = { views: 0, rules: 0, groups: 0, steps: 0 };
    const runs = 500;
    fc.assert(
      fc.property(stored, (raw) => {
        const { views } = readViews(raw);
        if (views.length > 0) reached.views += 1;
        const rules = views.flatMap((view) => view.rules);
        if (rules.length > 0) reached.rules += 1;
        if (rules.some((rule) => rule.when.children.some(isGroup))) reached.groups += 1;
        if (rules.some((rule) => rule.steps.length > 0)) reached.steps += 1;
      }),
      { numRuns: runs, seed: 1, endOnFailure: true },
    );
    expect(reached.views).toBeGreaterThan(runs / 3);
    expect(reached.rules).toBeGreaterThan(runs / 4);
    expect(reached.groups).toBeGreaterThan(runs / 20);
    expect(reached.steps).toBeGreaterThan(runs / 5);
  });
});

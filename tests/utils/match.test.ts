/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { describeCondition, matchesCondition, matchesRule } from '../../src/utils/match';
import type { Typed } from '../../src/utils/noteFacts';
import {
  group,
  makeCondition,
  makeContext,
  makeFacts,
  makeRule,
  noFacts,
  path,
  property,
  viewName,
} from '../factories';

/** No property is typed, which is what a vault without Daily Notes reports. */
const asText: Typed = (_key, value) => value;

describe('matchesCondition', () => {
  it('matches anything when nothing is asked', () => {
    expect(matchesCondition(makeCondition(), makeContext(), noFacts, asText)).toEqual({ ok: true });
  });

  it('names the row that refused, so the log can say why', () => {
    const condition = makeCondition([viewName('is', 'Kanban Board')]);

    expect(
      matchesCondition(condition, makeContext({ viewName: 'Table' }), noFacts, asText),
    ).toEqual({
      ok: false,
      missed: 'viewName',
    });
  });

  it('requires every row under "all"', () => {
    const condition = makeCondition([path('inFolder', 'Atlas'), viewName('is', 'Kanban Board')]);
    const context = makeContext({ path: 'Atlas/A.base', viewName: 'Table' });

    expect(matchesCondition(condition, context, noFacts, asText)).toEqual({
      ok: false,
      missed: 'viewName',
    });
  });

  it('needs one row under "or", and blames the first that refused', () => {
    const tests = [path('inFolder', 'Journal'), viewName('is', 'Kanban Board')];
    const context = makeContext({ path: 'Atlas/A.base', viewName: 'Kanban Board' });

    expect(matchesCondition(makeCondition(tests, 'or'), context, noFacts, asText)).toEqual({
      ok: true,
    });
    expect(
      matchesCondition(
        makeCondition(tests, 'or'),
        makeContext({ path: 'Atlas/A.base' }),
        noFacts,
        asText,
      ),
    ).toEqual({ ok: false, missed: 'path' });
  });

  /* The whole point of the tree: this and that, or neither of those. */
  it('reads a nested group as its own question', () => {
    const when = makeCondition([
      path('inFolder', 'Atlas'),
      group('or', property('due', 'exists'), property('tags', 'is', 'nav')),
    ]);
    const facts = makeFacts({ frontmatter: { due: '2026-09-10' } });

    expect(matchesCondition(when, makeContext({ path: 'Atlas/A.md' }), facts, asText).ok).toBe(
      true,
    );
    expect(matchesCondition(when, makeContext({ path: 'Journal/A.md' }), facts, asText).ok).toBe(
      false,
    );
  });

  it('holds a "not" group only when none of its children hold', () => {
    const when = makeCondition([
      group('not', path('inFolder', 'Archive'), path('contains', 'draft')),
    ]);

    expect(matchesCondition(when, makeContext({ path: 'Atlas/A.md' }), noFacts, asText).ok).toBe(
      true,
    );
    expect(matchesCondition(when, makeContext({ path: 'Archive/A.md' }), noFacts, asText).ok).toBe(
      false,
    );
    expect(
      matchesCondition(when, makeContext({ path: 'Atlas/draft.md' }), noFacts, asText).ok,
    ).toBe(false);
  });

  // An explicitly inserted nested group is now a draft until it contains a condition.
  it('blocks an empty nested group', () => {
    expect(matchesCondition(makeCondition([group('and')]), makeContext(), noFacts, asText).ok).toBe(
      false,
    );
  });
});

describe('property rows', () => {
  const facts = makeFacts({
    frontmatter: {
      type: 'task',
      due: '',
      related: '[[Kanban Board]]',
      tags: ['#nav/split', 'other'],
    },
  });

  it('asks about presence without a value', () => {
    expect(
      matchesCondition(makeCondition([property('type', 'exists')]), makeContext(), facts, asText)
        .ok,
    ).toBe(true);
    expect(
      matchesCondition(makeCondition([property('gone', 'missing')]), makeContext(), facts, asText)
        .ok,
    ).toBe(true);
  });

  /* The distinction the source plugin split apart after an incident. */
  it('does not call a property that is not there an empty one', () => {
    expect(
      matchesCondition(makeCondition([property('gone', 'empty')]), makeContext(), facts, asText).ok,
    ).toBe(false);
    expect(
      matchesCondition(makeCondition([property('due', 'empty')]), makeContext(), facts, asText).ok,
    ).toBe(true);
  });

  it('reads a link property as the note it names', () => {
    const condition = makeCondition([property('related', 'is', 'Kanban Board')]);
    expect(matchesCondition(condition, makeContext(), facts, asText).ok).toBe(true);
  });

  /* A property is what the frontmatter holds. A tag written in the body of the
   * note is not one, and the row says property. */
  it('reads a list property, matching a nested value from its parent', () => {
    const condition = makeCondition([property('tags', 'is', 'nav')]);
    expect(matchesCondition(condition, makeContext(), facts, asText).ok).toBe(true);
  });

  it('does not reach a tag that is only in the text of the note', () => {
    const bodyOnly = makeFacts({ frontmatter: {} });
    const condition = makeCondition([property('tags', 'exists')]);

    expect(matchesCondition(condition, makeContext(), bodyOnly, asText).ok).toBe(false);
  });

  it('compares a typed property as its type', () => {
    const dated = makeFacts({ frontmatter: { due: '2026-09-08' } });
    const typed: Typed = (key, value) => (key === 'due' ? '2026-09-08' : value);
    const condition = makeCondition([property('due', 'is', '08-09-2026')]);

    expect(matchesCondition(condition, makeContext(), dated, typed).ok).toBe(true);
    expect(matchesCondition(condition, makeContext(), dated, asText).ok).toBe(false);
  });

  it('refuses rather than throwing when there is no note', () => {
    const condition = makeCondition([property('type', 'exists')]);
    expect(matchesCondition(condition, makeContext(), noFacts, asText).ok).toBe(false);
  });
});

describe('matchesRule', () => {
  it('says a rule is off before it says anything else', () => {
    expect(matchesRule(makeRule({ enabled: false }), makeContext(), noFacts, asText)).toEqual({
      ok: false,
      missed: 'disabled',
    });
  });

  it('runs only a context trigger', () => {
    const rule = makeRule({ trigger: { kind: 'schedule', at: '09:00' } });
    expect(matchesRule(rule, makeContext(), noFacts, asText)).toEqual({
      ok: false,
      missed: 'trigger',
    });
  });
});

describe('describeCondition', () => {
  it('says Anything when nothing is asked', () => {
    expect(describeCondition(makeCondition())).toBe('Anything');
  });

  // Literal values are quoted to distinguish their text from expression operators.
  it('reads as a sentence, joined by the word the list is read with', () => {
    const condition = makeCondition([path('inFolder', 'Atlas'), property('type', 'is', 'task')]);
    expect(describeCondition(condition)).toBe('Path in folder "Atlas" and type is "task"');
  });

  it('leaves out the value for the rows that ask about presence', () => {
    expect(describeCondition(makeCondition([property('due', 'missing')]))).toBe('due is missing');
  });

  // Truncating the logical expression concealed operands and parentheses.
  it('describes every operand', () => {
    const tests = [property('a', 'exists'), property('b', 'exists'), property('c', 'exists')];
    expect(describeCondition(makeCondition(tests, 'or'))).toBe('a exists or b exists or c exists');
  });

  /* Parentheses carry meaning and must survive the summary. */
  it('preserves explicit groups', () => {
    const when = makeCondition([path('inFolder', 'Atlas'), group('or', property('due', 'exists'))]);
    expect(describeCondition(when)).toBe('Path in folder "Atlas" and (due exists)');
  });
});

describe('mixed expression truth tables', () => {
  it('uses NOT then AND then OR, with explicit parentheses overriding precedence', () => {
    for (let bits = 0; bits < 8; bits++) {
      const a = Boolean(bits & 1);
      const b = Boolean(bits & 2);
      const c = Boolean(bits & 4);
      const facts = makeFacts({
        frontmatter: { ...(a ? { a: 1 } : {}), ...(b ? { b: 1 } : {}), ...(c ? { c: 1 } : {}) },
      });
      const A = property('a', 'exists');
      const B = { ...property('b', 'exists'), join: 'or' as const };
      const C = { ...property('c', 'exists'), negated: true as const };
      const flat = { kind: 'group' as const, children: [A, B, C] };
      const bracketed = {
        kind: 'group' as const,
        children: [{ kind: 'group' as const, children: [A, B] }, C],
      };
      expect(matchesCondition(flat, makeContext(), facts, asText).ok).toBe(a || (b && !c));
      expect(matchesCondition(bracketed, makeContext(), facts, asText).ok).toBe((a || b) && !c);
      expect(matchesCondition({ ...flat, negated: true }, makeContext(), facts, asText).ok).toBe(
        !(a || (b && !c)),
      );
    }
  });

  it('negates an empty current group', () => {
    expect(
      matchesCondition(
        { kind: 'group', children: [], negated: true },
        makeContext(),
        noFacts,
        asText,
      ).ok,
    ).toBe(false);
  });
});

describe('unfinished properties', () => {
  it('never executes a draft, including beneath NOT and alongside a true OR operand', () => {
    const draft = property('', 'missing');
    for (const condition of [
      { kind: 'group' as const, children: [draft] },
      { kind: 'group' as const, children: [{ ...draft, negated: true as const }] },
      { kind: 'group' as const, negated: true as const, children: [draft] },
      {
        kind: 'group' as const,
        children: [
          path('contains', 'Atlas'),
          { kind: 'group' as const, join: 'or' as const, children: [draft] },
        ],
      },
    ]) {
      expect(matchesCondition(condition, makeContext(), makeFacts(), asText)).toEqual({
        ok: false,
        missed: 'property',
      });
    }
  });
});

describe('draft execution safety', () => {
  it('blocks unfinished nested groups and required values even when OR or NOT would match', () => {
    // Empty operands now represent work in progress, rather than Boolean constants.
    for (const draft of [
      group('and'),
      path('contains', ''),
      path('notContains', ' '),
      viewName('is', ''),
      property('status', 'is', ''),
    ]) {
      for (const negated of [undefined, true] as const) {
        const condition = {
          kind: 'group' as const,
          ...(negated ? { negated } : {}),
          children: [
            path('contains', 'Atlas'),
            { ...draft, join: 'or' as const, negated: true as const },
          ],
        };
        expect(matchesCondition(condition, makeContext(), makeFacts(), asText).ok).toBe(false);
      }
    }
  });

  it('keeps value-less presence operators executable', () => {
    const facts = makeFacts({ frontmatter: { status: '' } });
    for (const row of [
      property('status', 'exists'),
      property('gone', 'missing'),
      property('status', 'empty'),
    ]) {
      expect(matchesCondition(group('and', row), makeContext(), facts, asText).ok).toBe(true);
    }
  });
});

describe('precedence in expression descriptions', () => {
  const a = property('a', 'exists');
  const b = property('b', 'exists');
  const c = property('c', 'exists');

  it('adds parentheses to AND runs on either side of OR', () => {
    expect(describeCondition({ kind: 'group', children: [a, { ...b, join: 'or' }, c] })).toBe(
      'a exists or (b exists and c exists)',
    );
    expect(describeCondition({ kind: 'group', children: [a, b, { ...c, join: 'or' }] })).toBe(
      '(a exists and b exists) or c exists',
    );
  });

  it('preserves explicit nested parentheses and existing negation', () => {
    expect(
      describeCondition({ kind: 'group', negated: true, children: [group('or', a, b), c] }),
    ).toBe('not ((a exists or b exists) and c exists)');
    expect(describeCondition(group('and', path('is', 'A or (B and C)')))).toBe(
      'Path is "A or (B and C)"',
    );
  });
});

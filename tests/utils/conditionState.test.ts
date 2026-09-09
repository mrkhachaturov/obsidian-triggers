/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { OPERATORS } from '../../src/types/registry';
import type { Filter, Group } from '../../src/types/rule';
import { conditionIncomplete, countConditions } from '../../src/utils/conditionState';
import { group, path, property, viewName } from '../factories';

describe('conditionIncomplete', () => {
  it('distinguishes an empty root from an unfinished nested group', () => {
    expect(conditionIncomplete(group('and'))).toBe(false);
    expect(conditionIncomplete(group('and', group('and')))).toBe(true);
    expect(conditionIncomplete(group('and', group('and', group('and'))))).toBe(true);
  });

  it.each(['', ' ', '\t\n'])(
    'requires nonblank values for text and path comparisons: %j',
    (value) => {
      for (const row of [
        path('contains', value),
        path('inFolder', value),
        viewName('is', value),
        property('status', 'is', value),
      ]) {
        expect(conditionIncomplete(group('and', row))).toBe(true);
      }
    },
  );

  it('uses the operator registry to distinguish value-less property operators', () => {
    for (const spec of OPERATORS) {
      if (spec.op === 'inFolder' || spec.op === 'notInFolder') continue;
      expect(conditionIncomplete(group('and', property('status', spec.op)))).toBe(spec.value);
    }
    expect(conditionIncomplete(group('and', property(' ', 'exists')))).toBe(true);
  });

  it('does not let OR or NOT conceal a draft', () => {
    const drafts: Filter[] = [group('and'), path('is', ''), property('', 'exists')];
    for (const draft of drafts) {
      const expression: Group = {
        kind: 'group',
        negated: true,
        children: [path('contains', 'A'), { ...draft, join: 'or', negated: true }],
      };
      expect(conditionIncomplete(expression)).toBe(true);
    }
  });
});

describe('countConditions', () => {
  it('counts leaf rows including drafts but excludes group wrappers', () => {
    expect(countConditions(group('and'))).toBe(0);
    expect(countConditions(group('and', group('and')))).toBe(0);
    expect(
      countConditions(
        group(
          'and',
          path('is', ''),
          group('and', property('status', 'exists'), group('and', viewName('is', 'Table'))),
        ),
      ),
    ).toBe(3);
  });
});

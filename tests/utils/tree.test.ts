/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import type { ViewRules } from '../../src/types/rule';
import {
  editRule,
  findRule,
  findView,
  moveWithin,
  removeAt,
  removeRule,
  withRules,
} from '../../src/utils/tree';
import { makeRule, makeView } from '../factories';

const views: ViewRules[] = [
  makeView('markdown', [makeRule({ id: 'a', name: 'A' })]),
  makeView('bases', [makeRule({ id: 'b', name: 'B' }), makeRule({ id: 'c', name: 'C' })]),
];

describe('findView', () => {
  it('finds a view by id', () => {
    expect(findView(views, 'bases')?.viewType).toBe('bases');
  });

  it('returns null rather than throwing on an id that is gone', () => {
    expect(findView(views, 'missing')).toBeNull();
  });
});

describe('findRule', () => {
  it('finds a rule wherever it lives', () => {
    expect(findRule(views, 'c')?.name).toBe('C');
  });

  it('returns null rather than throwing on an id that is gone', () => {
    expect(findRule(views, 'missing')).toBeNull();
  });
});

describe('editRule', () => {
  it('replaces one rule and leaves the original alone', () => {
    const next = editRule(views, 'c', (rule) => ({ ...rule, name: 'Renamed' }));

    expect(findRule(next, 'c')?.name).toBe('Renamed');
    expect(findRule(views, 'c')?.name).toBe('C');
  });
});

describe('withRules', () => {
  it('replaces the rules of one view only', () => {
    const next = withRules(views, 'bases', (rules) => rules.slice(0, 1));

    expect(findView(next, 'bases')?.rules).toHaveLength(1);
    expect(findView(next, 'markdown')?.rules).toHaveLength(1);
  });

  it('leaves every view alone when the id is gone', () => {
    expect(withRules(views, 'missing', () => [])).toEqual(views);
  });
});

describe('moveWithin', () => {
  it('moves an entry to a new index', () => {
    expect(moveWithin(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('leaves the list alone when the target is off the end', () => {
    expect(moveWithin(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('removeAt', () => {
  it('removes by index', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });
});

describe('removeRule', () => {
  it('removes a rule without knowing which view holds it', () => {
    const next = removeRule(views, 'b');

    expect(findRule(next, 'b')).toBeNull();
    expect(findView(next, 'bases')?.rules).toHaveLength(1);
  });

  it('leaves the views alone when the id is gone', () => {
    expect(removeRule(views, 'missing')).toEqual(views);
  });
});

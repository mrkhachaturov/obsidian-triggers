/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { STRINGS_EN } from '../../src/i18n/locales/en';
import {
  FIELDS,
  FRONTMATTER_PREFIX,
  fieldSpec,
  OPERATOR,
  OPERATORS,
  VARIABLE_NAME,
  VARIABLES,
} from '../../src/types/registry';

/* The screen and docs/reference.md are built from these lists, so a row that is
 * wrong here is wrong in both places at once. */

function reachable(path: string): boolean {
  let value: unknown = STRINGS_EN;
  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null) return false;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string';
}

describe('the operator list', () => {
  it('names a string that exists', () => {
    for (const spec of OPERATORS) expect(reachable(spec.label), spec.label).toBe(true);
  });

  it('says what each one holds, for the generated reference', () => {
    for (const spec of OPERATORS) expect(spec.holds.length, spec.op).toBeGreaterThan(0);
  });

  it('has one entry per operator, and the lookup finds every one', () => {
    expect(OPERATOR.size).toBe(OPERATORS.length);
    for (const spec of OPERATORS) expect(OPERATOR.get(spec.op)).toBe(spec);
  });

  /* Three of them ask about presence, and the value field is hidden for those. */
  it('marks exactly the presence operators as taking no value', () => {
    const withoutValue = OPERATORS.filter((spec) => !spec.value).map((spec) => spec.op);
    expect(withoutValue).toEqual(['exists', 'missing', 'empty']);
  });
});

describe('the field list', () => {
  it('names strings that exist', () => {
    for (const spec of FIELDS) {
      expect(reachable(spec.label), spec.label).toBe(true);
      expect(reachable(spec.hint), spec.hint).toBe(true);
    }
  });

  it('offers only operators the registry declares', () => {
    for (const spec of FIELDS) {
      for (const op of spec.ops)
        expect(OPERATOR.get(op), `${spec.field} offers ${op}`).toBeDefined();
    }
  });

  it('asks for a property name on the one field that needs one', () => {
    expect(FIELDS.filter((spec) => spec.key).map((spec) => spec.field)).toEqual(['property']);
  });

  /* A row that could never hold is not offered where it cannot: only a Base has
   * a current view. */
  it('restricts the base view to bases, and restricts nothing else', () => {
    expect(
      FIELDS.filter((spec) => spec.views !== undefined).map((spec) => [spec.field, spec.views]),
    ).toEqual([['viewName', ['bases']]]);
  });

  it('falls back to a real field when asked for one it does not have', () => {
    expect(fieldSpec('nonsense' as never)).toBe(FIELDS[0]);
  });
});

describe('the variable list', () => {
  it('namespaces every variable, so a user variable cannot be overwritten', () => {
    for (const variable of VARIABLES)
      expect(variable.name.startsWith('trigger.'), variable.name).toBe(true);
  });

  it('builds its lookup from the same rows the reference reads', () => {
    for (const variable of VARIABLES) expect(VARIABLE_NAME[variable.field]).toBe(variable.name);
  });

  it('derives the frontmatter prefix from the row rather than repeating it', () => {
    expect(FRONTMATTER_PREFIX).toBe('trigger.fm');
  });
});

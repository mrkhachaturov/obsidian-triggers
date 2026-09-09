/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { strings } from '../i18n';
import type { Context } from '../types/context';
import { type Filter, type Group, isGroup, type Rule, type Test } from '../types/rule';
import type { MissField } from '../types/trace';
import { asText, inFolder, listHolds, textHolds } from './compare';
import { incompleteConditionField } from './conditionState';
import type { Facts, Typed } from './noteFacts';

export type Match = { readonly ok: true } | { readonly ok: false; readonly missed: MissField };

const OK: Match = { ok: true };

/**
 * Whether one row of the When list holds.
 *
 * A property row is the only one that reads the note, and it reads an index
 * Obsidian already built.
 */
function holds(test: Test, context: Context, facts: Facts, typed: Typed): boolean {
  if (test.field === 'path') {
    const path = context.path;
    if (path === null) return test.op === 'notContains' || test.op === 'notInFolder';

    if (test.op === 'inFolder') return inFolder(path, test.value);
    if (test.op === 'notInFolder') return !inFolder(path, test.value);
    return textHolds(path, test.value, test.op);
  }

  if (test.field === 'viewName') {
    const name = context.viewName;
    if (name === null) return test.op === 'notContains';
    return textHolds(name, test.value, test.op);
  }

  const note = facts();
  if (note === null) return false;

  const key = test.key.trim();
  const held = note.frontmatter[key];

  if (test.op === 'exists') return held !== undefined && held !== null;
  if (test.op === 'missing') return held === undefined || held === null;
  /* A property that is not there is not an empty one - that question is `missing`. */
  if (test.op === 'empty') {
    if (held === undefined || held === null) return false;
    if (Array.isArray(held)) return held.length === 0;
    /* A map holds something, whatever we can say about it. */
    if (typeof held === 'object') return false;
    return asText(held).trim() === '';
  }

  return listHolds(held, typed(key, test.value), test.op);
}

/** Evaluate OR-separated AND runs, with each group acting as parentheses. */
function groupHolds(group: Group, context: Context, facts: Facts, typed: Typed): boolean {
  let run = true;
  let result = false;
  for (const [index, child] of group.children.entries()) {
    if (index > 0 && child.join === 'or') {
      result ||= run;
      if (result) return group.negated !== true;
      run = true;
    }
    run = run && operandHolds(child, context, facts, typed);
  }
  const held = result || run;
  return group.negated === true ? !held : held;
}

function operandHolds(child: Filter, context: Context, facts: Facts, typed: Typed): boolean {
  if (isGroup(child)) return groupHolds(child, context, facts, typed);
  const held = holds(child, context, facts, typed);
  return child.negated === true ? !held : held;
}

/** The first row that refused, for "why did it not run". */
function refusedBy(group: Group, context: Context, facts: Facts, typed: Typed): MissField {
  if (group.negated === true) return 'any';
  for (const child of group.children) {
    if (isGroup(child)) {
      if (!groupHolds(child, context, facts, typed)) return refusedBy(child, context, facts, typed);
      continue;
    }
    if (!operandHolds(child, context, facts, typed)) return child.field;
  }
  /* Every row held on its own and the group still refused: the shape did, not a row. */
  return 'any';
}

export function matchesCondition(
  condition: Group,
  context: Context,
  facts: Facts,
  typed: Typed,
): Match {
  const incomplete = incompleteConditionField(condition);
  if (incomplete !== null) return { ok: false, missed: incomplete };
  if (groupHolds(condition, context, facts, typed)) return OK;
  return { ok: false, missed: refusedBy(condition, context, facts, typed) };
}

export function matchesRule(rule: Rule, context: Context, facts: Facts, typed: Typed): Match {
  if (!rule.enabled) return { ok: false, missed: 'disabled' };
  if (rule.trigger.kind !== 'context') return { ok: false, missed: 'trigger' };
  return matchesCondition(rule.when, context, facts, typed);
}

/** Explicit parentheses expose AND precedence when a group also contains OR. */
export function describeCondition(condition: Group): string {
  const runs: string[][] = [];
  let run: string[] = [];
  for (const [index, child] of condition.children.entries()) {
    if (index > 0 && child.join === 'or') {
      runs.push(run);
      run = [];
    }
    const content = isGroup(child) ? `(${describeCondition(child)})` : describeTest(child);
    run.push(
      !isGroup(child) && child.negated === true ? `${strings.joins.not} (${content})` : content,
    );
  }
  runs.push(run);
  const expression =
    condition.children.length === 0
      ? strings.condition.anything
      : runs
          .map((terms) => {
            const text = terms.join(` ${strings.joins.and} `);
            return runs.length > 1 && terms.length > 1 ? `(${text})` : text;
          })
          .join(` ${strings.joins.or} `);
  return condition.negated === true ? `${strings.joins.not} (${expression})` : expression;
}

function describeTest(test: Test): string {
  const subject =
    test.field === 'property' ? test.key || strings.fields.property : strings.fields[test.field];
  const operator = strings.ops[test.op];
  const presence = test.op === 'exists' || test.op === 'missing' || test.op === 'empty';

  return presence
    ? `${subject} ${operator}`
    : `${subject} ${operator} ${JSON.stringify(test.value)}`;
}

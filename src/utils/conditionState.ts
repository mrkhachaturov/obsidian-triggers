/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { OPERATOR } from '../types/registry';
import { type Group, isGroup } from '../types/rule';
import type { MissField } from '../types/trace';

/** The root may be empty; an empty nested group is an unfinished operand. */
export function incompleteConditionField(group: Group): MissField | null {
  for (const child of group.children) {
    if (isGroup(child)) {
      if (child.children.length === 0) return 'any';
      const missed = incompleteConditionField(child);
      if (missed !== null) return missed;
    } else {
      if (child.field === 'property' && child.key.trim().length === 0) return 'property';
      if (OPERATOR.get(child.op)?.value !== false && child.value.trim().length === 0)
        return child.field;
    }
  }
  return null;
}

/** Draft operands block the whole expression, including OR and negated branches. */
export function conditionIncomplete(group: Group): boolean {
  return incompleteConditionField(group) !== null;
}

/** Count condition rows, excluding the groups that put parentheses around them. */
export function countConditions(group: Group): number {
  return group.children.reduce(
    (count, child) => count + (isGroup(child) ? countConditions(child) : 1),
    0,
  );
}

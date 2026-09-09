/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { FIELDS, fieldSpec, OPERATOR } from '../types/registry';
import {
  EMPTY_WHEN,
  type Field,
  type Filter,
  type Group,
  MAX_DEPTH,
  newId,
  type Operand,
  type Rule,
  type Step,
  type Test,
  type Trigger,
  type ViewRules,
} from '../types/rule';

/* Guards, not casts. A list entry can be a hole - null, a stray primitive, an
 * object missing the key that makes it what it claims to be - and a hole is
 * skipped rather than crashed on. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* An id addresses a rule; an empty one addresses nothing. A stored value is a
 * different matter - an empty one there is a convention the operators rely on. */
function identity(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : newId();
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * One row of the When list.
 *
 * A row naming a field or an operator this build does not have is dropped: it
 * cannot be evaluated, and keeping it would mean a rule that silently means
 * something other than what it says.
 */
function test(value: unknown): Test | null {
  if (!isRecord(value)) return null;

  const field = FIELDS.find((spec) => spec.field === value['field'])?.field;
  if (field === undefined) return null;

  const spec = fieldSpec(field);
  const op = spec.ops.find((entry) => entry === value['op']);
  if (op === undefined) return null;

  if (value['value'] !== undefined && typeof value['value'] !== 'string') return null;
  const text = str(value['value'], '');

  if (field === 'property') {
    if (typeof value['key'] !== 'string') return null;
    const key = value['key'].trim();
    return { field, key, op, value: OPERATOR.get(op)?.value === false ? '' : text } as Test;
  }

  return { field, op, value: text } as Test;
}

/** Reject a damaged expression whole: dropping a child can widen its rule. */
function operand(value: Record<string, unknown>): Operand | null {
  if (value['join'] !== undefined && value['join'] !== 'and' && value['join'] !== 'or') return null;
  if (value['negated'] !== undefined && typeof value['negated'] !== 'boolean') return null;
  return {
    ...(value['join'] === 'or' ? { join: 'or' } : {}),
    ...(value['negated'] === true ? { negated: true } : {}),
  };
}

function filter(value: unknown, depth: number): Filter | null {
  if (!isRecord(value)) return null;
  const modifiers = operand(value);
  if (modifiers === null) return null;
  if (
    value['kind'] === undefined &&
    !('conjunction' in value) &&
    typeof value['field'] === 'string'
  ) {
    const row = test(value);
    return row === null ? null : { ...row, ...modifiers };
  }
  if (value['kind'] !== 'group' || 'field' in value || 'conjunction' in value || depth >= MAX_DEPTH)
    return null;
  if (!Array.isArray(value['children'])) return null;
  const children: Filter[] = [];
  for (const raw of value['children']) {
    const child = filter(raw, depth + 1);
    if (child === null) return null;
    const { join: _join, ...first } = child;
    children.push(children.length === 0 ? first : child);
  }
  return { kind: 'group', children, ...modifiers };
}

function condition(value: unknown): Group | null {
  const parsed = filter(value, 0);
  return parsed !== null && 'kind' in parsed ? parsed : null;
}

function trigger(value: unknown): Trigger {
  if (isRecord(value) && value['kind'] === 'schedule')
    return { kind: 'schedule', at: str(value['at'], '') };
  return { kind: 'context' };
}

function step(value: unknown): Step | null {
  if (!isRecord(value)) return null;
  if (value['kind'] === 'command' && typeof value['commandId'] === 'string') {
    return { kind: 'command', commandId: value['commandId'] };
  }
  if (value['kind'] === 'quickadd' && typeof value['choiceName'] === 'string') {
    return {
      kind: 'quickadd',
      choiceId: str(value['choiceId'], ''),
      choiceName: value['choiceName'],
    };
  }
  return null;
}

function rule(value: Record<string, unknown>): Rule | null {
  const when = 'when' in value ? condition(value['when']) : EMPTY_WHEN;
  if (when === null) return null;
  return {
    id: identity(value['id']),
    name: str(value['name'], 'Untitled rule'),
    enabled: bool(value['enabled'], true),
    trigger: trigger(value['trigger']),
    when,
    steps: Array.isArray(value['steps'])
      ? value['steps'].map(step).filter((entry): entry is Step => entry !== null)
      : [],
    stop: bool(value['stop'], false),
  };
}

export interface ReadResult {
  readonly views: ViewRules[];
  readonly skipped: number;
}

/**
 * Read the stored views.
 *
 * One unreadable entry costs that entry and nothing else: the count comes back so
 * the load can say what it dropped rather than pretending the file was clean.
 *
 * An entry with no view type is not a chain this plugin can walk, so it is
 * dropped like any other hole.
 */
export function readViews(value: unknown): ReadResult {
  if (!Array.isArray(value)) return { views: [], skipped: 0 };

  const views: ViewRules[] = [];
  let skipped = 0;
  /* Ids address a rule: the settings reorder by them, an import replaces by them,
   * the trace names them. A repeated one is repaired rather than dropped, because
   * losing a rule costs more than minting an id the user never sees. Found by the
   * property tests. */
  const ids = new Set<string>();
  const unique = (id: string): string => {
    const free = ids.has(id) ? newId() : id;
    ids.add(free);
    return free;
  };

  for (const raw of value) {
    if (!isRecord(raw) || typeof raw['viewType'] !== 'string' || raw['viewType'].length === 0) {
      skipped += 1;
      continue;
    }

    if (raw['rules'] !== undefined && !Array.isArray(raw['rules'])) {
      skipped += 1;
      continue;
    }
    const viewType = raw['viewType'];
    const rules: Rule[] = [];

    for (const entry of Array.isArray(raw['rules']) ? raw['rules'] : []) {
      const parsed = isRecord(entry) ? rule(entry) : null;
      if (parsed !== null) rules.push({ ...parsed, id: unique(parsed.id) });
      else skipped += 1;
    }

    /* At most one chain per view type, which is what the shape declares. A
     * repeated type is merged into the one already read: dropping it would take
     * the user's rules with it. Found by the property tests. */
    const at = views.findIndex((view) => view.viewType === viewType);
    const existing = views[at];
    if (existing === undefined) views.push({ id: unique(identity(raw['id'])), viewType, rules });
    else views[at] = { ...existing, rules: [...existing.rules, ...rules] };
  }

  return { views, skipped };
}

/** A row as it is created: the first operator the field offers, nothing filled in. */
export function newTest(field: Field): Test {
  const spec = fieldSpec(field);
  const op = spec.ops[0] ?? 'is';
  return field === 'property'
    ? ({ field, key: '', op, value: '' } as Test)
    : ({ field, op, value: '' } as Test);
}

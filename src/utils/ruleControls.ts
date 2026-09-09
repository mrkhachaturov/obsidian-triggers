/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Rule } from '../types/rule';

/* A declarative control names the value it edits with a string, and the settings
 * tab is handed that string with no context. It carries the rule it belongs to,
 * so a rule edited on one page cannot write over another.
 *
 * Only the rule's own fields are addressed this way. The When tree is drawn and
 * written by its rows: a row holds four controls on one line, and a group holds
 * buttons, neither of which a single declarative control can be. */

const SEPARATOR = '/';

export type Part = 'name' | 'enabled' | 'stop';

const PARTS: readonly Part[] = ['name', 'enabled', 'stop'];

export function ruleKey(ruleId: string, part: Part): string {
  return `${ruleId}${SEPARATOR}${part}`;
}

export interface ControlKey {
  readonly ruleId: string;
  readonly part: Part;
}

/** Split a key back into the rule and what it points at. Null when it is not one of ours. */
export function readKey(key: string): ControlKey | null {
  const at = key.indexOf(SEPARATOR);
  if (at <= 0) return null;

  const part = PARTS.find((entry) => entry === key.slice(at + 1));
  return part === undefined ? null : { ruleId: key.slice(0, at), part };
}

/** The value a control shows. */
export function readControl(rule: Rule, part: Part): unknown {
  if (part === 'name') return rule.name;
  if (part === 'enabled') return rule.enabled;
  return rule.stop;
}

/** The rule as it is after a control changed. A value of the wrong type leaves the rule alone. */
export function writeControl(rule: Rule, part: Part, value: unknown): Rule {
  if (part === 'name') return typeof value === 'string' ? { ...rule, name: value } : rule;
  if (typeof value !== 'boolean') return rule;
  return part === 'enabled' ? { ...rule, enabled: value } : { ...rule, stop: value };
}

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Rule, ViewRules } from '../types/rule';

/* Two levels, so two sets of helpers and no recursion. Everything is replaced
 * rather than mutated: every field is readonly, so an edit produces a new branch
 * and leaves the rest shared. */

export function findView(views: readonly ViewRules[], id: string): ViewRules | null {
  return views.find((view) => view.id === id) ?? null;
}

export function findRule(views: readonly ViewRules[], id: string): Rule | null {
  for (const view of views) {
    const found = view.rules.find((rule) => rule.id === id);
    if (found !== undefined) return found;
  }
  return null;
}

export function editRule(
  views: readonly ViewRules[],
  id: string,
  change: (rule: Rule) => Rule,
): ViewRules[] {
  return views.map((view) => ({
    ...view,
    rules: view.rules.map((rule) => (rule.id === id ? change(rule) : rule)),
  }));
}

/** Replace the rules of one view, leaving every other view untouched. */
export function withRules(
  views: readonly ViewRules[],
  viewId: string,
  change: (rules: readonly Rule[]) => readonly Rule[],
): ViewRules[] {
  return views.map((view) =>
    view.id === viewId ? { ...view, rules: [...change(view.rules)] } : view,
  );
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, at) => at !== index);
}

export function moveWithin<T>(items: readonly T[], from: number, to: number): T[] {
  const moving = items[from];
  if (moving === undefined || to < 0 || to >= items.length) return [...items];

  const rest = items.filter((_, at) => at !== from);
  rest.splice(to, 0, moving);
  return rest;
}

/** Remove a rule wherever it lives: a rule's page knows the rule, not its view. */
export function removeRule(views: readonly ViewRules[], ruleId: string): ViewRules[] {
  return views.map((view) => ({ ...view, rules: view.rules.filter((rule) => rule.id !== ruleId) }));
}

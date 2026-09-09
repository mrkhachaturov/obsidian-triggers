/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Context } from '../src/types/context';
import {
  type Conjunction,
  EMPTY_WHEN,
  type Filter,
  type Group,
  type PathOp,
  type PropertyOp,
  type Rule,
  type Step,
  type Test,
  type TextOp,
  type ViewRules,
} from '../src/types/rule';
import type { Facts, NoteFacts } from '../src/utils/noteFacts';

/* Shared fixtures. A test that needs an object builds it here, so the casts that
 * bridge Obsidian's types live in one file instead of every test. */

/** A note that says nothing, for the rules that never ask. */
export const noFacts: Facts = () => null;

export function makeFacts(over: Partial<NoteFacts> = {}): Facts {
  const facts: NoteFacts = { frontmatter: {}, ...over };
  return () => facts;
}

export function makeContext(over: Partial<Context> = {}): Context {
  return { viewType: 'markdown', path: 'Atlas/Note.md', viewName: null, ...over };
}

export function makeCondition(
  children: Filter[] = [],
  conjunction: Conjunction | 'not' = 'and',
): Group {
  return group(conjunction, ...children);
}

/** A nested group, so a test states the tree it means and nothing else. */
export function group(conjunction: Conjunction | 'not', ...children: Filter[]): Group {
  return {
    kind: 'group',
    ...(conjunction === 'not' && children.length > 0 ? { negated: true } : {}),
    children: children.map((child, index) => {
      const { join: _join, ...operand } = child;
      return index > 0 && conjunction !== 'and' ? { ...operand, join: 'or' } : operand;
    }),
  };
}

/* One row each, so a test states only what it means. */
export const path = (op: PathOp, value: string): Test => ({ field: 'path', op, value });

export const viewName = (op: TextOp, value: string): Test => ({ field: 'viewName', op, value });

export const property = (key: string, op: PropertyOp, value = ''): Test => ({
  field: 'property',
  key,
  op,
  value,
});

export function makeRule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: 'Rule',
    enabled: true,
    trigger: { kind: 'context' },
    when: EMPTY_WHEN,
    steps: [],
    stop: false,
    ...over,
  };
}

/** One chain: the view type it is written for, and the rules in it. */
export function makeView(viewType: string, rules: Rule[] = [], id = viewType): ViewRules {
  return { id, viewType, rules };
}

export function commandStep(commandId: string): Step {
  return { kind: 'command', commandId };
}

export function quickAddStep(choiceId: string, choiceName: string): Step {
  return { kind: 'quickadd', choiceId, choiceName };
}

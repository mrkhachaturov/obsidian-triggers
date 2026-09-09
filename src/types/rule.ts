/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

/* The shapes in docs/rule-format.md. Change the document before changing these. */

/** Binary link to the preceding operand; AND binds before OR. */
export type Conjunction = 'and' | 'or';

export interface Operand {
  readonly join?: Conjunction;
  readonly negated?: true;
}

export type TextOp = 'is' | 'contains' | 'notContains' | 'startsWith' | 'endsWith';
export type PathOp = TextOp | 'inFolder' | 'notInFolder';
export type PropertyOp = TextOp | 'exists' | 'missing' | 'empty';

export type Field = Test['field'];

/** One row of the When list: what is compared, how, and with what. */
export type Test = Operand &
  (
    | { readonly field: 'path'; readonly op: PathOp; readonly value: string }
    /** The Base's current view, e.g. `Kanban Board`. Offered only under `bases`. */
    | { readonly field: 'viewName'; readonly op: TextOp; readonly value: string }
    /** `value` is ignored by the three operators that ask about presence. */
    | {
        readonly field: 'property';
        readonly key: string;
        readonly op: PropertyOp;
        readonly value: string;
      }
  );

export interface Group extends Operand {
  readonly kind: 'group';
  /** Empty holds, which is what a rule with nothing filled in should do. */
  readonly children: readonly Filter[];
}

/* Groups have an explicit tag; tests retain their field discriminant. */
export type Filter = Test | Group;

export function isGroup(filter: Filter): filter is Group {
  return 'kind' in filter && filter.kind === 'group';
}

/* No view type here: that is the chain a rule lives in. */

export type Trigger =
  | { readonly kind: 'context' }
  | { readonly kind: 'schedule'; readonly at: string };

export type Step =
  | { readonly kind: 'command'; readonly commandId: string }
  /* Both are stored: the id survives a rename, the name is what executeChoice takes. */
  | { readonly kind: 'quickadd'; readonly choiceId: string; readonly choiceName: string };

export type StepKind = Step['kind'];

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: Trigger;
  readonly when: Group;
  readonly steps: readonly Step[];
  /** Ends the walk after this rule has run. */
  readonly stop: boolean;
}

/**
 * The rules written for one view, the way a firewall's chains are one each.
 *
 * At the top level you are not making a folder, you are choosing which view you
 * are about to write rules for - so the view type is its name, and there is at
 * most one of these per view type.
 *
 * It holds rules and never another one of itself: nested chains would buy the
 * expressiveness of `jump` and `return`, which is QuickAdd's, and would cost a
 * screen where someone has to hold a tree in their head to answer "why did this
 * run".
 */
export interface ViewRules {
  readonly id: string;
  /** `markdown`, `bases`, `canvas`, or a view type another plugin registers. */
  readonly viewType: string;
  readonly rules: readonly Rule[];
}

export const SCHEMA_VERSION = 1;

export interface PluginData {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  /** The top level holds views and nothing else. */
  readonly views: readonly ViewRules[];
}

export const DEFAULT_DATA: PluginData = { schemaVersion: SCHEMA_VERSION, views: [] };

/* Adding a second row narrows a rule rather than widening it, so `and` is where
 * a group starts. */
export const EMPTY_WHEN: Group = { kind: 'group', children: [] };

/** How deep a hand-written file may nest before we stop reading it. */
export const MAX_DEPTH = 5;

export function newId(): string {
  return crypto.randomUUID();
}

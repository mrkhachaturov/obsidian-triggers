/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { newId, type Rule, SCHEMA_VERSION, type ViewRules } from '../types/rule';
import { readViews } from './readData';

/** The shape in docs/rule-format.md. */
export interface RulePackage {
  readonly schemaVersion: number;
  readonly pluginVersion: string;
  readonly createdAt: string;
  readonly views: readonly ViewRules[];
}

/* Bumped when a package written today can no longer be read. A file carrying a
 * higher number is refused rather than half-read. */

/** What to do with an entry the vault already holds. New entries are always added. */
/**
 * What to do with a view the vault already has. A view is its view type, so there
 * is no "add as a copy": two `markdown` views cannot exist. Bringing the rules
 * alongside the ones already there is what a copy becomes.
 */
export type Conflict = 'replace' | 'merge' | 'skip';

export interface Analysis {
  readonly views: readonly ViewRules[];
  /** Entries the file carried but could not be read. */
  readonly unreadable: number;
  /** How many of the readable views the vault already has. */
  readonly known: number;
}

export interface Applied {
  readonly views: readonly ViewRules[];
  readonly added: number;
  readonly replaced: number;
  readonly merged: number;
  readonly skipped: number;
}

export function write(views: readonly ViewRules[], pluginVersion: string): string {
  const packaged: RulePackage = {
    schemaVersion: SCHEMA_VERSION,
    pluginVersion,
    createdAt: new Date().toISOString(),
    views,
  };
  return `${JSON.stringify(packaged, null, 2)}\n`;
}

export type ReadFailure = 'unreadable' | 'newer' | 'empty';

/**
 * Read a package and measure it against what is here.
 *
 * Nothing is changed: the counts exist so the user is told what an import will
 * do before it does it.
 */
export function analyse(text: string, current: readonly ViewRules[]): Analysis | ReadFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'unreadable';
  }

  if (typeof parsed !== 'object' || parsed === null) return 'unreadable';
  const source = parsed as Record<string, unknown>;

  const version = source['schemaVersion'];
  if (typeof version === 'number' && version > SCHEMA_VERSION) return 'newer';
  if (version !== undefined && version !== SCHEMA_VERSION) return 'unreadable';

  const { views, skipped } = readViews(source['views']);
  if (views.length === 0) return 'empty';

  const here = new Set(current.map((view) => view.viewType));
  return {
    views,
    unreadable: skipped,
    known: views.filter((view) => here.has(view.viewType)).length,
  };
}

/** Apply an analysed package. One choice covers every entry already here. */

/** Apply an analysed package. One choice covers every view already here. */
export function apply(
  current: readonly ViewRules[],
  incoming: readonly ViewRules[],
  conflict: Conflict,
): Applied {
  const here = new Map(current.map((view) => [view.viewType, view]));
  let added = 0;
  let replaced = 0;
  let merged = 0;
  let skipped = 0;

  const appended: ViewRules[] = [];
  const changed = new Map<string, ViewRules>();

  for (const view of incoming) {
    const stored = here.get(view.viewType);

    if (stored === undefined) {
      appended.push(view);
      added += 1;
      continue;
    }
    if (conflict === 'skip') {
      skipped += 1;
      continue;
    }
    if (conflict === 'merge') {
      changed.set(view.viewType, { ...stored, rules: [...stored.rules, ...fresh(view.rules)] });
      merged += 1;
      continue;
    }

    changed.set(view.viewType, { ...stored, rules: view.rules });
    replaced += 1;
  }

  const views = current.map((view) => changed.get(view.viewType) ?? view);
  return { views: [...views, ...appended], added, replaced, merged, skipped };
}

/* A rule arriving beside one already there has to be a different thing, or
 * editing one edits both. */
function fresh(rules: readonly Rule[]): Rule[] {
  return rules.map((rule) => ({ ...rule, id: newId() }));
}

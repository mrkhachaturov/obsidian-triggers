/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

/** Where the user is. Everything a rule matches on comes from here. */
export interface Context {
  /** `markdown`, `bases`, `canvas`, or whatever a plugin registered. */
  readonly viewType: string;
  /** Vault path of the file the view shows, when it shows one. */
  readonly path: string | null;
  /** The view a Base is on, e.g. `Kanban Board`. Null everywhere else. */
  readonly viewName: string | null;
}

export function sameContext(a: Context | null, b: Context | null): boolean {
  if (a === null || b === null) return a === b;
  return a.viewType === b.viewType && a.path === b.path && a.viewName === b.viewName;
}

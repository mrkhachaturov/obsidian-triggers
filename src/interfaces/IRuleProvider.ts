/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { ViewRules } from '../types/rule';

/** What the runner needs: the views, in order, and nothing else. */
export interface IRuleProvider {
  views(): readonly ViewRules[];
}

/** What the settings need on top of that: a way to change them. */
export interface IRuleEditor extends IRuleProvider {
  update(change: (views: readonly ViewRules[]) => readonly ViewRules[]): Promise<void>;
}

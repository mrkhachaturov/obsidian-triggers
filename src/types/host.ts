/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import type { IChoiceSource } from '../interfaces/IChoiceSource';
import type { IContextReader } from '../interfaces/IContextReader';
import type { IRuleEditor } from '../interfaces/IRuleProvider';
import type { IStepRegistry } from '../interfaces/IStepRegistry';
import type { ITraceLog } from '../interfaces/ITraceLog';
import type { ViewRules } from './rule';

/** What the plugin hands the settings tab. Interfaces only: the tab knows no service. */
export interface SettingsServices {
  readonly editor: IRuleEditor;
  readonly steps: IStepRegistry;
  readonly choices: IChoiceSource;
  readonly trace: ITraceLog;
  /** Where the user is, for the rows that run a rule on demand. */
  readonly reader: IContextReader;
  /** From the manifest, so an exported package says what wrote it. */
  readonly version: string;
}

/** What every page of the settings screen is given. */
export interface SettingsHost extends SettingsServices {
  readonly app: App;
  /**
   * Change the rules and rebuild the screen.
   *
   * Rebuilding is for what moves the tree - a rule added, removed, reordered or
   * renamed. A control editing its own value must never call it: the page would
   * be rebuilt under the cursor on every keystroke.
   */
  change(edit: (views: readonly ViewRules[]) => readonly ViewRules[]): Promise<void>;
  /** Rebuild the screen after something outside the rules moved. */
  refresh(): void;
}

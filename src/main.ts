/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { Plugin } from 'obsidian';
import type { IContextReader } from './interfaces/IContextReader';
import { ContextWatcher } from './services/ContextWatcher';
import type { Context } from './types/context';

/* Wiring only. Every service is constructed here and handed what it needs;
   none of them reaches back into the plugin for a sibling. */
export default class TriggersPlugin extends Plugin {
  private contextWatcher: ContextWatcher | null = null;

  readonly api = {
    version: 1,
    context: (): Context | null => this.reader()?.current() ?? null,
    onContextChange: (listener: (context: Context | null) => void): (() => void) =>
      this.reader()?.onChange(listener) ?? (() => undefined),
  };

  override onload(): void {
    const contextWatcher = new ContextWatcher(this);
    this.contextWatcher = contextWatcher;
    contextWatcher.start();
  }

  private reader(): IContextReader | null {
    return this.contextWatcher;
  }
}

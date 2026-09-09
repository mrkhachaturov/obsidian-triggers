/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 *
 * Surfaces Obsidian exposes but does not declare. Everything here is read
 * defensively at the call site: a missing member means the feature degrades, not
 * that the plugin fails.
 */

import 'obsidian';

declare module 'obsidian' {
  interface Command {
    id: string;
    name: string;
  }

  interface App {
    commands: {
      commands: Record<string, Command>;
      findCommand(id: string): Command | undefined;
      executeCommandById(id: string): boolean;
    };
    plugins: {
      plugins: Record<string, unknown>;
    };
    /* No public API reads a property's registered type. Re-check on every
     * minAppVersion bump. */
    metadataTypeManager?: {
      getPropertyInfo?(name: string): { widget?: string } | undefined;
      getAssignedWidget?(name: string): string | undefined;
    };
    /* Nor a core plugin's settings, which is where the vault's date format is. */
    internalPlugins?: {
      plugins: Record<
        string,
        { enabled?: boolean; instance?: { options?: Record<string, unknown> } } | undefined
      >;
    };
    viewRegistry?: {
      viewByType?: Record<string, unknown>;
    };
  }
}

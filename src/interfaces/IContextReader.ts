/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Context } from '../types/context';

/**
 * The slice a rule needs: where the user is, and word when that changes.
 *
 * Rules depend on this rather than on the watcher, so matching can be tested
 * against a hand-written context and the workspace stays out of it.
 */
export interface IContextReader {
  current(): Context | null;
  /** Returns the unsubscribe. */
  onChange(listener: (context: Context | null) => void): () => void;
}

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { LogEntry } from '../types/trace';

/** What the Log page reads and changes. */
export interface ITraceLog {
  readonly recording: boolean;
  setRecording(on: boolean): void;
  /** Newest first. */
  list(): readonly LogEntry[];
  clear(): void;
  /** Data is updated before subscribers are notified; returns an unsubscribe. */
  onChange(listener: () => void): () => void;
}

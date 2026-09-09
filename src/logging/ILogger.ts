/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

export type Level = 'error' | 'warning' | 'message';

export interface Report {
  readonly level: Level;
  readonly message: string;
  readonly at: number;
  readonly stack?: string;
}

/** A sink the log fans out to. The console, the screen and the trace are three. */
export interface ILogger {
  receive(report: Report): void;
}

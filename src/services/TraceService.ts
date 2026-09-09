/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import type { ITraceLog } from '../interfaces/ITraceLog';
import type { ILogger, Report } from '../logging/ILogger';
import type { LogEntry, TraceEntry } from '../types/trace';

/** A ring, sized once. A session that never opens settings must not grow. */
const CAPACITY = 200;

/* Per-device, and deliberately not in data.json: recording describes the machine
 * someone is debugging on, and must not sync to a machine where nobody is. */
const STORAGE_KEY = 'triggers:recording';

/**
 * What the plugin decided, and every report it made.
 *
 * Reports are always kept: they are rare, and an error nobody recorded is an error
 * nobody can explain. The decision trace is not - it costs an object per rule per
 * navigation - so it is off until the user asks for it.
 */
export class TraceService implements ILogger, ITraceLog {
  private readonly entries: LogEntry[] = [];
  private readonly app: App;
  private tracing: boolean;
  private readonly listeners = new Set<() => void>();

  constructor(app: App) {
    this.app = app;
    this.tracing = readFlag(app);
  }

  receive(report: Report): void {
    this.push({ kind: 'report', at: report.at, level: report.level, message: report.message });
  }

  /** Whether the runner should bother describing what it is doing. */
  get recording(): boolean {
    return this.tracing;
  }

  setRecording(on: boolean): void {
    if (this.tracing === on) return;
    this.tracing = on;
    writeFlag(this.app, on);
    this.changed();
  }

  record(entry: TraceEntry): void {
    if (!this.tracing) return;
    this.push({ kind: 'trace', ...entry });
  }

  /** Newest first, which is the order the Log page reads them. */
  list(): readonly LogEntry[] {
    return [...this.entries].reverse();
  }

  clear(): void {
    if (this.entries.length === 0) return;
    this.entries.length = 0;
    this.changed();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private changed(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A diagnostics subscriber must not interrupt rule dispatch or recurse into this log.
      }
    }
  }

  private push(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > CAPACITY) this.entries.shift();
    this.changed();
  }
}

/* Obsidian's own device-local store, not `window.localStorage`: it is namespaced
 * per vault, and the directory's scanner reports raw web storage. The switch
 * still belongs here rather than in `data.json` - it is for the machine being
 * debugged on, and must not sync to the others. */
function readFlag(app: App): boolean {
  try {
    return app.loadLocalStorage(STORAGE_KEY) === true;
  } catch {
    return false;
  }
}

function writeFlag(app: App, on: boolean): void {
  try {
    app.saveLocalStorage(STORAGE_KEY, on ? true : null);
  } catch {
    /* A preference that could not be remembered still applies to this session. */
  }
}

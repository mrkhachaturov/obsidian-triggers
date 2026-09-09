/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { ILogger, Level, Report } from './ILogger';

/**
 * The registry every report passes through. Sinks register themselves, and each
 * one decides what to do with a report.
 */
class Log {
  private readonly sinks: ILogger[] = [];

  register(sink: ILogger): () => void {
    this.sinks.push(sink);
    return () => {
      const at = this.sinks.indexOf(sink);
      if (at >= 0) this.sinks.splice(at, 1);
    };
  }

  send(level: Level, message: string, stack?: string): void {
    const report: Report =
      stack === undefined
        ? { level, message, at: Date.now() }
        : { level, message, at: Date.now(), stack };
    for (const sink of [...this.sinks]) {
      try {
        sink.receive(report);
      } catch {
        // A failed sink must not suppress diagnostics elsewhere or recurse into the same bus.
      }
    }
  }
}

export const log = new Log();

/* One helper for the whole plugin. A second one is how the "never mutate the
 * caller's Error" rule stops holding at the call sites that need it most. */
function toMessage(err: unknown, context?: string): { message: string; stack?: string } {
  const base = err instanceof Error ? err.message : String(err);
  const message = context === undefined ? base : `${context}: ${base}`;
  const stack = err instanceof Error ? err.stack : undefined;
  return stack === undefined ? { message } : { message, stack };
}

/* An error already reported is not reported again. The mark goes on the value, not
 * the chain: reporting a wrapper must not silence its parts. */
const reported = new WeakSet<object>();

export function reportError(err: unknown, context?: string, level: Level = 'error'): boolean {
  if (typeof err === 'object' && err !== null) {
    if (reported.has(err)) return false;
    reported.add(err);
  }

  const { message, stack } = toMessage(err, context);
  log.send(level, message, stack);
  return true;
}

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { Notice } from 'obsidian';
import type { ILogger, Report } from './ILogger';

const ERROR_NOTICE_MS = 15000;

/** The one place a Notice is constructed; ESLint refuses `new Notice` elsewhere. */
export function notify(message: string, variant?: 'success' | 'warning'): void {
  const notice = new Notice(`Triggers: ${message}`);
  if (variant !== undefined)
    notice.containerEl.addClass(variant === 'success' ? 'mod-success' : 'mod-warning');
}

/* warn, error and debug are the console methods Obsidian's own lint rule allows;
 * info is not one of them. */
export class ConsoleSink implements ILogger {
  receive(report: Report): void {
    const line = `Triggers: ${report.message}`;
    if (report.level === 'error') console.error(line, report.stack ?? '');
    else if (report.level === 'warning') console.warn(line);
    else console.debug(line);
  }
}

/**
 * The screen. An error is held long enough to read, a warning uses the default
 * duration, and a message never reaches the user at all — it is for the console
 * and the trace.
 */
export class NoticeSink implements ILogger {
  receive(report: Report): void {
    if (report.level === 'error') new Notice(`Triggers: ${report.message}`, ERROR_NOTICE_MS);
    else if (report.level === 'warning') new Notice(`Triggers: ${report.message}`);
  }
}

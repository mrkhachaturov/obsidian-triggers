/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { type App, moment } from 'obsidian';

/**
 * What a note says about itself.
 *
 * Its properties, and nothing else. A tag written in the body of the note is not
 * one of them: the row says property, so it means property.
 */
export interface NoteFacts {
  readonly frontmatter: Record<string, unknown>;
}

/** Absent when there is no note, or nothing has been indexed for it yet. */
export type Facts = () => NoteFacts | null;

/**
 * Read a note's properties.
 *
 * `getFileCache` reads an index Obsidian already built; the file is not opened.
 */
export function readNoteFacts(app: App, path: string | null): NoteFacts | null {
  if (path === null) return null;

  const file = app.vault.getFileByPath(path);
  if (file === null) return null;

  const cache = app.metadataCache.getFileCache(file);
  if (cache === null) return null;

  return { frontmatter: cache.frontmatter ?? {} };
}

/** Read once per event, and only if a rule asks. */
export function lazyFacts(app: App, path: string | null): Facts {
  let read = false;
  let facts: NoteFacts | null = null;

  return () => {
    if (!read) {
      facts = readNoteFacts(app, path);
      read = true;
    }
    return facts;
  };
}

/* Ported from obsidian-conditional-properties (Diego Eis, MIT): the value a user
 * writes has to be spelled the way the property stores it before it is compared. */

/** Rewrites what the user typed into the spelling the property holds. */
export type Typed = (key: string, value: string) => string;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* Obsidian re-exports moment as a namespace, so the callable form needs saying
 * once. Strict parsing: a format either matches or it is not this one. */
const parseDate = moment as unknown as (
  input: string,
  format: string,
  strict: boolean,
) => { isValid(): boolean; format(shape: string): string };

/* Tried in order, first match wins. `MM-DD-YYYY` is deliberately absent: it makes
 * `03-04` ambiguous, and guessing wrong is worse than not guessing. */
const FALLBACK_FORMATS = ['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY/MM/DD'];

/**
 * Compare a typed property as its type.
 *
 * `08-09-2026` against a `date` property holding `2026-09-08` holds, and `true`
 * against a checkbox holding a boolean holds. An unknown or absent type leaves
 * the value as text, which is the behaviour without any of this.
 */
export function typedValues(app: App): Typed {
  return (key, value) => {
    const widget = propertyType(app, key);
    if (widget === 'checkbox') return String(value.trim().toLowerCase() === 'true');
    if (widget === 'date') return isoDate(app, value);
    if (widget === 'datetime') return value.trim();
    return value;
  };
}

/* Instance state, not a declared API: `getPropertyInfo` reports the effective
 * widget, including one Obsidian inferred, which `getAssignedWidget` misses. */
function propertyType(app: App, key: string): string | undefined {
  try {
    const manager = app.metadataTypeManager;
    if (manager === undefined) return undefined;

    const widget = manager.getPropertyInfo?.(key)?.widget;
    return widget ?? manager.getAssignedWidget?.(key);
  } catch {
    return undefined;
  }
}

function isoDate(app: App, value: string): string {
  const text = value.trim();
  if (ISO.test(text)) return text;

  for (const format of dateFormats(app)) {
    const parsed = parseDate(text, format, true);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }
  return text;
}

/* How this vault writes dates: what the user configured first, then the common
 * shapes. */
function dateFormats(app: App): string[] {
  const configured: string[] = [];

  try {
    const core = app.internalPlugins?.plugins;
    const read = (id: string, field: string): void => {
      const entry = core?.[id];
      const format = entry?.enabled === true ? entry.instance?.options?.[field] : undefined;
      if (typeof format === 'string' && format.length > 0) configured.push(format);
    };
    read('daily-notes', 'format');
    read('templates', 'dateFormat');
  } catch {
    /* Without them the fallbacks still parse the usual shapes. */
  }

  return [...new Set([...configured, ...FALLBACK_FORMATS])];
}

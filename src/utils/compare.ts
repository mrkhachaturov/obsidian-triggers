/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 *
 * Ported from obsidian-conditional-properties
 * Copyright (c) 2026 Diego Eis
 * SPDX-License-Identifier: MIT
 *
 * The comparison rules in this file are theirs, kept because each one is an
 * answer to a case a real vault produced. See docs/rule-format.md.
 */

import { strings } from '../i18n';
import { log } from '../logging/log';
import type { TextOp } from '../types/rule';

/* `/pattern/flags`, the convention Obsidian's own Web Clipper uses for URL
 * triggers. At least one character between the slashes; the flags are not
 * validated here, so an unknown one fails loudly at construction rather than
 * being silently read as a literal string. */
const REGEX_LITERAL = /^\/(.+)\/([a-z]*)$/;

function isPattern(value: string): boolean {
  return REGEX_LITERAL.test(value);
}

/* Compiled once and reused: matching runs on every navigation. A pattern that
 * cannot be built is stored as null and never matches. */
const compiled = new Map<string, RegExp | null>();
const reported = new Set<string>();

/**
 * Compile a `/pattern/flags` value.
 *
 * `g` and `y` are stripped. A cached expression carries `lastIndex` between
 * calls, so with either flag the second context would silently stop matching -
 * measured in the source plugin, and inherited the moment a cache is used.
 *
 * A malformed pattern is reported once, because a rule that cannot fire has to
 * be explainable.
 */
export function pattern(raw: string): RegExp | null {
  const cached = compiled.get(raw);
  if (cached !== undefined) return cached;

  const parts = REGEX_LITERAL.exec(raw);
  const body = parts?.[1] ?? raw;
  const flags = (parts?.[2] ?? '').replace(/[gy]/g, '');

  let built: RegExp | null;
  try {
    built = new RegExp(body, flags);
  } catch (err) {
    built = null;
    if (!reported.has(raw)) {
      reported.add(raw);
      log.send(
        'warning',
        `${strings.match.badPattern} ${raw}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  compiled.set(raw, built);
  return built;
}

/**
 * A value as text, or nothing when it has no honest flat form.
 *
 * Obsidian registers twelve property types and none of them is a map, so a
 * nested one is outside the vocabulary: `[object Object]` would compare as a
 * value nobody wrote.
 */
export function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * The one shape both sides of a comparison are reduced to.
 *
 * A `related` property holds `[[Kanban Board]]` on disk and the user writes
 * `Kanban Board`; YAML round-trips quotes nobody typed; a tag is written `#task`
 * in the text and `task` in the frontmatter. All four are the same thing here.
 */
export function normalise(value: unknown): string {
  let text = asText(value).replace(/\[\[([^\]]+)\]\]/g, '$1');

  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);

  return text.trim().toLowerCase().replace(/^#/, '');
}

/**
 * `project` matches `project/active`.
 *
 * Ours, not the source plugin's: a nested tag is a hierarchy, and a rule about
 * the parent is a rule about the branch.
 */
function sameOrChildOf(held: string, wanted: string): boolean {
  return held === wanted || held.startsWith(`${wanted}/`);
}

/**
 * Compare one held value against what the user wrote.
 *
 * An empty value is a stated convention: the positive form never holds and the
 * negative form always does, because there is nothing to compare against.
 */
export function textHolds(
  held: unknown,
  wanted: string,
  op: TextOp,
  /** Only a property value is a hierarchy; a path that starts with a folder is `inFolder`. */
  nested = false,
): boolean {
  if (isPattern(wanted)) {
    /* The raw stored value, not the normalised one: an expression is written
     * against what is on disk. */
    const expression = pattern(wanted);
    const hit = expression !== null && expression.test(asText(held));
    return op === 'notContains' ? !hit : hit;
  }

  const target = normalise(wanted);
  const value = normalise(held);

  if (op === 'is') return nested ? sameOrChildOf(value, target) : value === target;
  /* Nothing to compare against: the positive forms fail, the negative one passes. */
  if (target === '') return op === 'notContains';

  if (op === 'startsWith') return value.startsWith(target);
  if (op === 'endsWith') return value.endsWith(target);
  return op === 'notContains' ? !value.includes(target) : value.includes(target);
}

/** A list holds when one entry holds; `notContains` only when every entry misses. */
export function listHolds(held: unknown, wanted: string, op: TextOp): boolean {
  if (!Array.isArray(held)) return textHolds(held, wanted, op, true);

  return op === 'notContains'
    ? held.every((entry) => textHolds(entry, wanted, op, true))
    : held.some((entry) => textHolds(entry, wanted, op, true));
}

/**
 * The value's segments, contiguous and in order, anywhere in the folder path.
 *
 * `Bases` finds `Atlas/Bases/TaskNotes/kanban.base`; `transcripts/meetings` does
 * not find `meetings/transcripts/note.md`. The prefix rule this replaces was
 * anchored at the vault root, so it matched nothing in the shape our own hint
 * text advertises.
 */
export function inFolder(path: string, wanted: string): boolean {
  const target = wanted
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  if (target.length === 0) return false;

  const folder = path.slice(0, Math.max(0, path.lastIndexOf('/')));
  const segments = folder
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  for (let at = 0; at + target.length <= segments.length; at += 1) {
    if (target.every((part, index) => segments[at + index] === part)) return true;
  }
  return false;
}

/* Ported from obsidian-conditional-properties: a hint only, never matching logic.
 * These constructs are very unlikely in plain frontmatter or a path, so a value
 * carrying one probably meant to be an expression and forgot its slashes. */
const UNWRAPPED = /\\[dDwWsSbB]|\(\?[:=!<]|\{\d+(,\d*)?\}|\[[^\]]*[-^][^\]]*\]/;

/** Whether to offer the "wrap it in slashes" hint under a value field. */
export function looksLikePattern(value: string): boolean {
  return value.length > 0 && !isPattern(value) && UNWRAPPED.test(value);
}

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

/**
 * The forms a counted noun takes. `other` is the only one every language needs;
 * English adds `one`, Russian adds `few` and `many`, and a language added later
 * brings whichever it uses.
 *
 * This file imports nothing, and must not: the locales import it, and the
 * reference generator runs those under plain Node.
 */
export interface Plural {
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
}

/** Declares a plural entry, so a locale may carry forms English does not have. */
export function forms(plural: Plural): Plural {
  return plural;
}

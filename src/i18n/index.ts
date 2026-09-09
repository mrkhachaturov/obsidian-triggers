/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { getLanguage } from 'obsidian';
import { STRINGS_EN } from './locales/en';
import { STRINGS_RU } from './locales/ru';

export type Strings = typeof STRINGS_EN;

/* Obsidian's own language codes. A language absent here reads English rather
 * than a half-translated screen. */
const LOCALES: Record<string, Strings> = {
  en: STRINGS_EN,
  ru: STRINGS_RU,
};

function resolve(): Strings {
  return LOCALES[getLanguage()] ?? STRINGS_EN;
}

/** Resolved once: Obsidian reloads plugins when the language changes. */
export const strings: Strings = resolve();

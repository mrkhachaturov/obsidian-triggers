/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { getLanguage } from 'obsidian';

import type { Plural } from './forms.ts';

/* Built once. Reading the language is cheap; constructing the rules is not. */
let rules: Intl.PluralRules | null = null;

/** `2` and `элемента`, not `2` and `элементов`. */
export function count(value: number, plural: Plural): string {
  rules ??= new Intl.PluralRules(getLanguage() || 'en');
  const category = rules.select(value);
  return `${value} ${plural[category] ?? plural.other}`;
}

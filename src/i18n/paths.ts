/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { type Strings, strings } from './index';

/* A registry names its strings by path, so a generator can read the same entry
 * from en.ts that the settings screen reads at runtime. The type keeps a typo
 * from compiling. */
type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

export type StringPath = Leaves<Strings>;

export function t(path: StringPath): string {
  let value: unknown = strings;
  for (const part of path.split('.')) {
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : path;
}

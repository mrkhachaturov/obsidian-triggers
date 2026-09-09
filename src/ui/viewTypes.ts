/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';

/** Supported document types, in picker order. Plugin views require registration. */
const DOCUMENT_TYPES = [
  { id: 'markdown', name: 'Markdown', builtIn: true },
  { id: 'canvas', name: 'Canvas', builtIn: true },
  { id: 'bases', name: 'Bases', builtIn: true },
  { id: 'excalidraw', name: 'Excalidraw', builtIn: false },
] as const;

/** The registry only checks availability; it does not define the supported list. */
export function viewTypes(app: App): string[] {
  const registered = app.viewRegistry?.viewByType;
  const readable =
    typeof registered === 'object' && registered !== null && !Array.isArray(registered);
  return DOCUMENT_TYPES.filter((type) =>
    readable ? Object.keys(registered).includes(type.id) : type.builtIn,
  ).map((type) => type.id);
}

export function viewTypeName(id: string): string {
  return DOCUMENT_TYPES.find((type) => type.id === id)?.name ?? id;
}

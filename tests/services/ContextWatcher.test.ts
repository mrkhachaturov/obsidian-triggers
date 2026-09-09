/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { readContext } from '../../src/services/ContextWatcher';
import { sameContext } from '../../src/types/context';

/* The states below were measured on Obsidian 1.13.2 and are copied verbatim. */

describe('readContext', () => {
  it('reads a Base and the view it is on', () => {
    const leaf = {
      getViewState: () => ({
        type: 'bases',
        state: {
          file: 'Atlas/Bases/TaskNotes/Views/kanban-default.base',
          viewName: 'Kanban Board',
        },
      }),
    };

    expect(readContext(leaf)).toEqual({
      viewType: 'bases',
      path: 'Atlas/Bases/TaskNotes/Views/kanban-default.base',
      viewName: 'Kanban Board',
    });
  });

  it('reads a note, which carries no view name', () => {
    const leaf = {
      getViewState: () => ({ type: 'markdown', state: { file: 'Atlas/Note.md', mode: 'source' } }),
    };

    expect(readContext(leaf)).toEqual({
      viewType: 'markdown',
      path: 'Atlas/Note.md',
      viewName: null,
    });
  });

  it('reads a view that has no file', () => {
    expect(readContext({ getViewState: () => ({ type: 'notebook-navigator' }) })).toEqual({
      viewType: 'notebook-navigator',
      path: null,
      viewName: null,
    });
  });

  it('has no context when no leaf is active', () => {
    expect(readContext(null)).toBeNull();
  });
});

describe('sameContext', () => {
  const base = { viewType: 'bases', path: 'A.base', viewName: 'Kanban Board' };

  it('holds for two readings of one place', () => {
    expect(sameContext(base, { ...base })).toBe(true);
  });

  /* The case the watcher exists for: same file, different view of it. */
  it('separates two views of the same Base', () => {
    expect(sameContext(base, { ...base, viewName: 'Table' })).toBe(false);
  });

  it('treats two empty contexts as one', () => {
    expect(sameContext(null, null)).toBe(true);
    expect(sameContext(base, null)).toBe(false);
  });
});

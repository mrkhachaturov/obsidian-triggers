/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import {
  inFolder,
  listHolds,
  looksLikePattern,
  normalise,
  pattern,
  textHolds,
} from '../../src/utils/compare';

/* Ported from obsidian-conditional-properties, so the cases they paid for are
 * the cases pinned here. See docs/rule-format.md. */

describe('normalise', () => {
  it('reads a wikilink as the note it names', () => {
    expect(normalise('[[Kanban Board]]')).toBe('kanban board');
  });

  it('drops quotes YAML round-tripped and nobody typed', () => {
    expect(normalise('"task"')).toBe('task');
  });

  it('makes a tag one thing however it was written', () => {
    expect(normalise('#Task ')).toBe('task');
    expect(normalise('task')).toBe('task');
  });

  it('turns an absent value into the empty string rather than "null"', () => {
    expect(normalise(null)).toBe('');
    expect(normalise(undefined)).toBe('');
  });
});

describe('textHolds', () => {
  it('compares exactly, ignoring case', () => {
    expect(textHolds('Atlas/Note.md', 'atlas/note.md', 'is')).toBe(true);
    expect(textHolds('Atlas/Note.md', 'atlas', 'is')).toBe(false);
  });

  /* The convention: nothing to compare against fails the positive form and
   * passes the negative one. */
  it('holds nothing on an empty value, and everything on its negation', () => {
    expect(textHolds('anything', '', 'contains')).toBe(false);
    expect(textHolds('anything', '', 'notContains')).toBe(true);
  });

  it('reads a value in slashes as an expression', () => {
    expect(textHolds('kanban-2026', '/kanban-\\d+/', 'contains')).toBe(true);
    expect(textHolds('kanban-none', '/kanban-\\d+/', 'contains')).toBe(false);
  });

  it('honours case in an expression until the flag says otherwise', () => {
    expect(textHolds('Report', '/report/', 'contains')).toBe(false);
    expect(textHolds('Report', '/report/i', 'contains')).toBe(true);
  });

  /* The two operators that make a wildcard language unnecessary. */
  it('compares the beginning and the end of a value', () => {
    expect(textHolds('temp-note.md', 'temp-', 'startsWith')).toBe(true);
    expect(textHolds('note-temp.md', 'temp-', 'startsWith')).toBe(false);
    expect(textHolds('Atlas/kanban.base', '.base', 'endsWith')).toBe(true);
    expect(textHolds('Atlas/kanban.base', '.md', 'endsWith')).toBe(false);
  });

  it('holds neither of them against an empty value', () => {
    expect(textHolds('anything', '', 'startsWith')).toBe(false);
    expect(textHolds('anything', '', 'endsWith')).toBe(false);
  });

  /* A child of the value is the value, for a property. A path that starts with a
   * folder is `inFolder`, not `is`. */
  it('matches a nested tag from its parent, and only for a property', () => {
    expect(textHolds('project/active', 'project', 'is', true)).toBe(true);
    expect(textHolds('project/active', 'project', 'is')).toBe(false);
  });
});

describe('pattern', () => {
  /* A cached expression carrying lastIndex made every other context miss. */
  it('strips the flags that would carry state between contexts', () => {
    const built = pattern('/task/gi');

    expect(built?.flags).toBe('i');
    expect(built?.test('a task')).toBe(true);
    expect(built?.test('a task')).toBe(true);
  });

  it('never throws on a pattern that cannot be built', () => {
    expect(pattern('/[unclosed/')).toBeNull();
  });
});

describe('listHolds', () => {
  it('holds when one entry holds', () => {
    expect(listHolds(['nav/split', 'task'], 'task', 'is')).toBe(true);
  });

  it('holds the negative form only when every entry misses', () => {
    expect(listHolds(['nav/split', 'task'], 'task', 'notContains')).toBe(false);
    expect(listHolds(['nav/split', 'other'], 'task', 'notContains')).toBe(true);
  });
});

describe('inFolder', () => {
  /* The prefix rule this replaced was anchored at the vault root, so the shape
   * our own hint text advertises matched nothing. */
  it('finds the folder at any depth', () => {
    expect(inFolder('Atlas/Bases/TaskNotes/kanban.base', 'Bases')).toBe(true);
    expect(inFolder('Atlas/Bases/TaskNotes/kanban.base', 'atlas/bases')).toBe(true);
  });

  it('needs the segments contiguous and in order', () => {
    expect(inFolder('Work/meetings/transcripts/note.md', 'meetings/transcripts')).toBe(true);
    expect(inFolder('Work/meetings/transcripts/note.md', 'transcripts/meetings')).toBe(false);
    expect(inFolder('Work/meetings/2026/transcripts/note.md', 'meetings/transcripts')).toBe(false);
  });

  it('never holds on an empty value, and never on the file itself', () => {
    expect(inFolder('Atlas/Note.md', '')).toBe(false);
    expect(inFolder('Atlas/Note.md', 'Note.md')).toBe(false);
  });
});

describe('looksLikePattern', () => {
  it('offers the hint only for text that meant to be an expression', () => {
    expect(looksLikePattern('\\d{4}')).toBe(true);
    expect(looksLikePattern('/\\d{4}/')).toBe(false);
    expect(looksLikePattern('Atlas/Bases')).toBe(false);
  });
});

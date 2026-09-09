/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyFacts, readNoteFacts, typedValues } from '../../src/utils/noteFacts';

const dateParser = vi.hoisted(() =>
  vi.fn((_input: string, _format: string, _strict: boolean) => ({
    isValid: (): boolean => false,
    format: (_shape: string): string => '',
  })),
);
vi.mock('obsidian', async (original) => ({
  ...(await original<typeof import('obsidian')>()),
  moment: dateParser,
}));
afterEach(() => dateParser.mockReset());

/** Stands in for the metadata cache, which is where a note's own words live. */
function appWith(cache: unknown, file: unknown = { path: 'Atlas/Note.md' }): App {
  return {
    vault: { getFileByPath: () => file },
    metadataCache: { getFileCache: () => cache },
  } as unknown as App;
}

describe('readNoteFacts', () => {
  /* Properties, and only properties: a tag written in the body of the note is
   * not one, whatever the cache holds beside them. */
  it('reads the properties the cache already holds, and nothing else', () => {
    const app = appWith({ frontmatter: { type: 'task' }, tags: [{ tag: '#urgent' }] });

    expect(readNoteFacts(app, 'Atlas/Note.md')).toEqual({ frontmatter: { type: 'task' } });
  });

  it('reads an empty note as empty, not as missing', () => {
    expect(readNoteFacts(appWith({}), 'Atlas/Note.md')).toEqual({ frontmatter: {} });
  });

  it('has nothing to read for a view with no file', () => {
    expect(readNoteFacts(appWith({}), null)).toBeNull();
  });

  it('has nothing to read when the path names no file', () => {
    expect(readNoteFacts(appWith({}, null), 'Gone.md')).toBeNull();
  });

  it('has nothing to read before the note is indexed', () => {
    expect(readNoteFacts(appWith(null), 'Atlas/Note.md')).toBeNull();
  });
});

describe('lazyFacts', () => {
  /* A rule that never asks about the note must not cost a cache lookup. */
  it('reads nothing until asked', () => {
    let reads = 0;
    const app = {
      vault: {
        getFileByPath: () => {
          reads += 1;
          return { path: 'Atlas/Note.md' };
        },
      },
      metadataCache: { getFileCache: () => ({}) },
    } as unknown as App;

    const facts = lazyFacts(app, 'Atlas/Note.md');
    expect(reads).toBe(0);

    facts();
    facts();
    expect(reads).toBe(1);
  });

  it('remembers that there was nothing to read', () => {
    let reads = 0;
    const app = {
      vault: {
        getFileByPath: () => {
          reads += 1;
          return null;
        },
      },
      metadataCache: { getFileCache: () => null },
    } as unknown as App;

    const facts = lazyFacts(app, 'Gone.md');
    expect(facts()).toBeNull();
    expect(facts()).toBeNull();
    expect(reads).toBe(1);
  });
});

function typedApp(widget: unknown, plugins: unknown = {}): App {
  return {
    metadataTypeManager: { getPropertyInfo: () => ({ widget }) },
    internalPlugins: { plugins },
  } as unknown as App;
}

describe('typed property normalization', () => {
  it('uses the effective inferred type and checks current metadata for every comparison', () => {
    let widget = 'checkbox';
    const assigned = vi.fn(() => 'text');
    const app = {
      metadataTypeManager: { getPropertyInfo: () => ({ widget }), getAssignedWidget: assigned },
    } as unknown as App;
    const typed = typedValues(app);
    expect(typed('done', ' TRUE ')).toBe('true');
    expect(typed('done', 'false')).toBe('false');
    expect(assigned).not.toHaveBeenCalled();
    widget = 'text';
    expect(typed('done', ' TRUE ')).toBe(' TRUE ');
  });

  it('falls back to assigned widgets and leaves unknown or inaccessible metadata as text', () => {
    const assigned = {
      metadataTypeManager: {
        getPropertyInfo: () => undefined,
        getAssignedWidget: () => 'datetime',
      },
    } as unknown as App;
    expect(typedValues(assigned)('due', ' 2026-09-08T12:00 ')).toBe('2026-09-08T12:00');
    for (const app of [
      {} as App,
      typedApp('custom'),
      {
        metadataTypeManager: {
          getPropertyInfo: () => {
            throw new Error('not ready');
          },
        },
      } as unknown as App,
    ]) {
      expect(typedValues(app)('x', '  unchanged  ')).toBe('  unchanged  ');
    }
  });

  it('accepts already normalized ISO text without consulting a parser', () => {
    expect(typedValues(typedApp('date'))('due', ' 2026-09-08 ')).toBe('2026-09-08');
    expect(dateParser).not.toHaveBeenCalled();
  });

  it('tries enabled vault formats first, removes duplicates, and uses strict parsing', () => {
    dateParser.mockImplementation((_input, format) => ({
      isValid: () => format === 'YYYY/MM/DD',
      format: () => '2026-09-08',
    }));
    const app = typedApp('date', {
      'daily-notes': { enabled: true, instance: { options: { format: 'DD-MM-YYYY' } } },
      templates: { enabled: true, instance: { options: { dateFormat: 'YYYY/MM/DD' } } },
    });
    expect(typedValues(app)('due', ' 2026/09/08 ')).toBe('2026-09-08');
    expect(dateParser.mock.calls).toEqual([
      ['2026/09/08', 'DD-MM-YYYY', true],
      ['2026/09/08', 'YYYY/MM/DD', true],
    ]);
  });

  it('ignores disabled and malformed format options and retains unparseable user text', () => {
    dateParser.mockImplementation(() => ({ isValid: () => false, format: () => '' }));
    const app = typedApp('date', {
      'daily-notes': { enabled: false, instance: { options: { format: 'MM-DD-YYYY' } } },
      templates: { enabled: true, instance: { options: { dateFormat: ['invalid'] } } },
    });
    expect(typedValues(app)('due', ' not a date ')).toBe('not a date');
    expect(dateParser.mock.calls.map((call) => call[1])).toEqual([
      'DD-MM-YYYY',
      'DD/MM/YYYY',
      'YYYY/MM/DD',
    ]);
  });

  it('keeps fallback formats available when core plugin settings are inaccessible', () => {
    dateParser.mockImplementation(() => ({ isValid: () => false, format: () => '' }));
    const app = typedApp('date');
    Object.defineProperty(app, 'internalPlugins', {
      get: () => {
        throw new Error('unloading');
      },
    });
    expect(typedValues(app)('due', 'unknown')).toBe('unknown');
    expect(dateParser).toHaveBeenCalledTimes(3);
  });
});

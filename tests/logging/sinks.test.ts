/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleSink, NoticeSink, notify } from '../../src/logging/sinks';

const notices = vi.hoisted(
  () => [] as { message: string; duration: number | undefined; classes: string[] }[],
);
vi.mock('obsidian', async (original) => ({
  ...(await original<typeof import('obsidian')>()),
  Notice: class {
    readonly containerEl: { addClass: (name: string) => void };
    constructor(message: string, duration?: number) {
      const notice = { message, duration, classes: [] as string[] };
      notices.push(notice);
      this.containerEl = {
        addClass: (name) => {
          notice.classes.push(name);
        },
      };
    }
  },
}));
afterEach(() => {
  notices.length = 0;
  vi.restoreAllMocks();
});

describe('log presentation sinks', () => {
  it('keeps ordinary diagnostic reports out of notices and gives errors time to be read', () => {
    const sink = new NoticeSink();
    sink.receive({ at: 1, level: 'message', message: 'trace only' });
    expect(notices).toEqual([]);
    sink.receive({ at: 2, level: 'warning', message: 'missing action' });
    sink.receive({ at: 3, level: 'error', message: 'save failed' });
    expect(notices).toEqual([
      { message: 'Triggers: missing action', duration: undefined, classes: [] },
      { message: 'Triggers: save failed', duration: 15000, classes: [] },
    ]);
  });

  it('styles explicit success and warning notifications independently', () => {
    notify('done', 'success');
    notify('not matched', 'warning');
    notify('information');
    expect(notices.map((notice) => notice.classes)).toEqual([['mod-success'], ['mod-warning'], []]);
  });

  it('routes levels to the intended console methods and preserves the error stack', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const sink = new ConsoleSink();
    sink.receive({ at: 1, level: 'error', message: 'failed', stack: 'stack detail' });
    sink.receive({ at: 2, level: 'warning', message: 'warning' });
    sink.receive({ at: 3, level: 'message', message: 'detail' });
    expect(error).toHaveBeenCalledExactlyOnceWith('Triggers: failed', 'stack detail');
    expect(warning).toHaveBeenCalledExactlyOnceWith('Triggers: warning');
    expect(debug).toHaveBeenCalledExactlyOnceWith('Triggers: detail');
  });
});

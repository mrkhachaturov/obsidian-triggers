/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { log, reportError } from '../../src/logging/log';

describe('logging lifecycle', () => {
  it('fans out the same timestamped report and stops delivering after teardown', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = log.register({ receive: first });
    const offSecond = log.register({ receive: second });
    try {
      log.send('warning', 'missing command');
      expect(first).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: 'missing command',
          at: expect.any(Number) as unknown,
        }),
      );
      expect(second.mock.calls[0]?.[0]).toBe(first.mock.calls[0]?.[0]);
      offFirst();
      offFirst();
      log.send('message', 'next');
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(2);
    } finally {
      offFirst();
      offSecond();
    }
  });

  it('isolates a failing sink so healthy sinks still receive reports', () => {
    const receive = vi.fn();
    const offBroken = log.register({
      receive: () => {
        throw new Error('sink failed');
      },
    });
    const offHealthy = log.register({ receive });
    try {
      expect(() => log.send('error', 'original failure')).not.toThrow();
      expect(receive).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'original failure' }),
      );
    } finally {
      offBroken();
      offHealthy();
    }
  });

  it('does not skip the next sink when the current sink unsubscribes during dispatch', () => {
    let offFirst = (): void => undefined;
    offFirst = log.register({ receive: () => offFirst() });
    const receive = vi.fn();
    const offSecond = log.register({ receive });
    try {
      log.send('message', 'one');
      log.send('message', 'two');
      expect(receive).toHaveBeenCalledTimes(2);
    } finally {
      offFirst();
      offSecond();
    }
  });

  it('deduplicates an error by identity, keeps its stack and never mutates the caller', () => {
    const receive = vi.fn();
    const off = log.register({ receive });
    const failure = Object.freeze(new Error('disk full'));
    const stack = failure.stack;
    try {
      expect(reportError(failure, 'Save')).toBe(true);
      expect(reportError(failure, 'Retry')).toBe(false);
      expect(failure.message).toBe('disk full');
      expect(failure.stack).toBe(stack);
      expect(receive).toHaveBeenCalledTimes(1);
      expect(receive).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Save: disk full', stack }),
      );
      expect(reportError(new Error('disk full'), 'Another save')).toBe(true);
    } finally {
      off();
    }
  });

  it('does not suppress repeated primitive failures or a distinct wrapper error', () => {
    const receive = vi.fn();
    const off = log.register({ receive });
    try {
      expect(reportError('offline', undefined, 'warning')).toBe(true);
      expect(reportError('offline', undefined, 'warning')).toBe(true);
      const inner = new Error('inner');
      expect(reportError(inner)).toBe(true);
      expect(reportError(new Error(`wrapper: ${inner.message}`))).toBe(true);
      expect(receive).toHaveBeenCalledTimes(4);
    } finally {
      off();
    }
  });
});

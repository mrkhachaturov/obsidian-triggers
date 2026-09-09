/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { log } from '../../../src/logging/log';
import { QuickAddHandler } from '../../../src/services/handlers/QuickAddHandler';
import { quickAddStep } from '../../factories';

/** Stands in for whatever QuickAdd happens to expose on the plugin registry. */
function appWith(instance: unknown): App {
  return {
    plugins: { plugins: instance === null ? {} : { quickadd: instance } },
  } as unknown as App;
}

const choice = (id: string, name: string) => ({ id, name, type: 'Macro' });

describe('QuickAddHandler when QuickAdd is missing', () => {
  it('reads no choices', () => {
    expect(new QuickAddHandler(appWith(null)).choices()).toEqual([]);
  });

  it('marks the step as unavailable rather than throwing', () => {
    expect(new QuickAddHandler(appWith(null)).available(quickAddStep('a', 'A'))).toBe(false);
  });

  it('reports instead of failing the rule', () => {
    const outcome = new QuickAddHandler(appWith(null)).run(quickAddStep('a', 'A'), {});
    expect(outcome).toEqual({ ok: false, detail: 'QuickAdd is not available' });
  });
});

describe('QuickAddHandler reading instance state', () => {
  it('keeps only entries that carry an id and a name', () => {
    const handler = new QuickAddHandler(
      appWith({ settings: { choices: [choice('a', 'A'), null, { id: 'b' }, { name: 'C' }, 7] } }),
    );

    expect(handler.choices()).toEqual([{ id: 'a', name: 'A', type: 'Macro' }]);
  });

  it('reads nothing when choices is not a list', () => {
    expect(new QuickAddHandler(appWith({ settings: { choices: 'nonsense' } })).choices()).toEqual(
      [],
    );
  });
});

describe('QuickAddHandler dispatch', () => {
  /* executeChoice takes a name, not an id, and reports rather than throws when it
   * misses. The id is what survives a rename, so the name is resolved at fire time. */
  it('resolves the current name from the stored id', () => {
    const executeChoice = vi.fn(() => Promise.resolve());
    const handler = new QuickAddHandler(
      appWith({ api: { executeChoice }, settings: { choices: [choice('a', 'Renamed')] } }),
    );

    const outcome = handler.run(quickAddStep('a', 'Old name'), { 'trigger.path': 'A.base' });

    expect(outcome).toEqual({ ok: true, detail: 'Renamed' });
    expect(executeChoice).toHaveBeenCalledWith('Renamed', { 'trigger.path': 'A.base' });
  });

  it('falls back to the stored name when the id is gone', () => {
    const executeChoice = vi.fn(() => Promise.resolve());
    const handler = new QuickAddHandler(
      appWith({ api: { executeChoice }, settings: { choices: [choice('other', 'Kept')] } }),
    );

    expect(handler.run(quickAddStep('gone', 'Kept'), {})).toEqual({ ok: true, detail: 'Kept' });
  });

  it('refuses when neither the id nor the name is there any more', () => {
    const executeChoice = vi.fn(() => Promise.resolve());
    const handler = new QuickAddHandler(
      appWith({ api: { executeChoice }, settings: { choices: [choice('other', 'Other')] } }),
    );

    expect(handler.run(quickAddStep('gone', 'Gone'), {})).toEqual({
      ok: false,
      detail: 'no choice "Gone"',
    });
    expect(executeChoice).not.toHaveBeenCalled();
  });

  /* A choice may open a prompt and sit there. Dispatch is this plugin's job;
   * finishing is QuickAdd's. */
  it('does not wait for the choice to finish', () => {
    let resolve = (): void => undefined;
    const executeChoice = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    const handler = new QuickAddHandler(
      appWith({ api: { executeChoice }, settings: { choices: [choice('a', 'A')] } }),
    );

    expect(handler.run(quickAddStep('a', 'A'), {})).toEqual({ ok: true, detail: 'A' });
    resolve();
  });
});

describe('QuickAdd runtime failure boundaries', () => {
  it('marks a loaded plugin without a callable API unavailable', () => {
    for (const api of [undefined, {}, { executeChoice: 'not callable' }]) {
      const handler = new QuickAddHandler(
        appWith({ api, settings: { choices: [choice('a', 'A')] } }),
      );
      expect(handler.available(quickAddStep('a', 'A'))).toBe(false);
      expect(handler.run(quickAddStep('a', 'A'), {}).ok).toBe(false);
    }
  });

  it('reports deferred rejection once without turning dispatch into an awaited operation', async () => {
    let rejectChoice: (reason: Error) => void = () => undefined;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectChoice = reject;
    });
    const handler = new QuickAddHandler(
      appWith({ api: { executeChoice: () => pending }, settings: { choices: [choice('a', 'A')] } }),
    );
    const receive = vi.fn();
    const unregister = log.register({ receive });
    try {
      expect(handler.run(quickAddStep('a', 'A'), {})).toEqual({ ok: true, detail: 'A' });
      expect(receive).not.toHaveBeenCalled();
      rejectChoice(new Error('macro failed'));
      await Promise.resolve();
      expect(receive).toHaveBeenCalledTimes(1);
      expect(receive).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: 'QuickAdd choice "A": macro failed' }),
      );
    } finally {
      unregister();
    }
  });
});

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Plugin } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { log } from '../../src/logging/log';
import { RuleStore } from '../../src/services/RuleStore';
import type { PluginData } from '../../src/types/rule';
import { makeRule, makeView } from '../factories';

/** Stands in for the plugin's data file. Records every write. */
function fakePlugin(stored: unknown): { plugin: Plugin; writes: unknown[] } {
  const writes: unknown[] = [];
  const plugin = {
    loadData: () => Promise.resolve(stored),
    saveData: (data: unknown) => {
      writes.push(data);
      return Promise.resolve();
    },
  } as unknown as Plugin;
  return { plugin, writes };
}

describe('RuleStore', () => {
  it('starts empty when there is no data file yet', async () => {
    const { plugin } = fakePlugin(null);
    const store = new RuleStore(plugin);

    await store.load();

    expect(store.views()).toEqual([]);
  });

  it('keeps the views in the order the file holds them', async () => {
    const { plugin } = fakePlugin({
      views: [
        { viewType: 'markdown', rules: [{ name: 'First' }] },
        { viewType: 'bases', rules: [{ name: 'Second' }] },
      ],
    });
    const store = new RuleStore(plugin);

    await store.load();

    expect(store.views().map((view) => view.viewType)).toEqual(['markdown', 'bases']);
  });

  it('persists an update', async () => {
    const { plugin, writes } = fakePlugin({ views: [] });
    const store = new RuleStore(plugin);
    await store.load();

    await store.update((views) => [...views, makeView('markdown')]);

    expect(writes).toHaveLength(1);
    expect(store.views()).toHaveLength(1);
  });

  /* The rule from AGENTS.md: substituting an empty value looks like healing until
   * the next save persists it and destroys what could have been recovered. */
  it('refuses to write when the stored views could not be read at all', async () => {
    const { plugin, writes } = fakePlugin({ views: 'not a list' });
    const store = new RuleStore(plugin);
    await store.load();

    await store.update((views) => [...views, makeView('markdown')]);

    expect(writes).toEqual([]);
  });

  it('keeps the readable rules when one of them is a hole', async () => {
    const { plugin } = fakePlugin({
      views: [{ viewType: 'markdown', rules: [null, { name: 'Kept' }] }],
    });
    const store = new RuleStore(plugin);

    await store.load();

    expect(store.views()[0]?.rules).toHaveLength(1);
    expect(store.views()[0]?.rules[0]?.name).toBe('Kept');
  });

  it('applies concurrent updates one after another', async () => {
    const { plugin, writes } = fakePlugin({ views: [makeView('markdown')] });
    const store = new RuleStore(plugin);
    await store.load();

    await Promise.all([
      store.update((views) => addRule(views, 'One')),
      store.update((views) => addRule(views, 'Two')),
    ]);

    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(['One', 'Two']);
    expect(writes).toHaveLength(2);
  });
});

function addRule(views: readonly ReturnType<typeof makeView>[], name: string) {
  return views.map((view) => ({ ...view, rules: [...view.rules, makeRule({ id: name, name })] }));
}

describe('schema persistence safety', () => {
  it('repairs without a startup write, then persists the schema and reloads identically', async () => {
    const { plugin, writes } = fakePlugin({
      views: [
        {
          viewType: 'markdown',
          rules: [
            {
              when: {
                kind: 'group',
                negated: true,
                children: [
                  { field: 'path', op: 'is', value: 'A' },
                  { field: 'path', op: 'is', value: 'B', join: 'or' },
                ],
              },
            },
          ],
        },
      ],
    });
    const store = new RuleStore(plugin);
    await store.load();
    /* A file missing its version is read, not rewritten: the repair rides out
     * on the next ordinary save. */
    expect(writes).toEqual([]);
    await store.update((views) => views);
    expect(writes[0]).toMatchObject({ schemaVersion: 1 });
    const reloaded = new RuleStore(fakePlugin(writes[0]).plugin);
    await reloaded.load();
    expect(reloaded.views()).toEqual(store.views());
  });

  it.each([
    'corrupt',
    [],
    { schemaVersion: 99, views: [] },
    { views: [{ viewType: 'markdown', rules: [{ when: { kind: 'group', children: [null] } }] }] },
    { views: [{ viewType: 'markdown', rules: null }] },
  ])('freezes persistence for unreadable stored data: %j', async (stored) => {
    const { plugin, writes } = fakePlugin(stored);
    const store = new RuleStore(plugin);
    await store.load();
    await store.update((views) => [...views, makeView('canvas')]);
    expect(writes).toEqual([]);
  });
});

describe('unfinished property drafts', () => {
  it('persists and reloads an explicit empty property key without losing the rule', async () => {
    const { plugin, writes } = fakePlugin(null);
    const store = new RuleStore(plugin);
    await store.load();
    const draft = makeView('markdown', [
      makeRule({
        when: { kind: 'group', children: [{ field: 'property', key: '', op: 'is', value: '' }] },
      }),
    ]);
    await store.update(() => [draft]);
    const reloadedPlugin = fakePlugin(writes[0]);
    const reloaded = new RuleStore(reloadedPlugin.plugin);
    await reloaded.load();
    expect(reloaded.views()).toEqual([draft]);
    await reloaded.update((views) => views);
    expect(reloadedPlugin.writes).toHaveLength(1);
  });
});

describe('RuleStore write queue failures', () => {
  it('does not start the next edit until the pending save settles, then recovers from rejection', async () => {
    let rejectSave: (reason: Error) => void = () => undefined;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    });
    const saveData = vi
      .fn<(data: PluginData) => Promise<void>>()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const store = new RuleStore({
      loadData: () => Promise.resolve({ views: [makeView('markdown')] }),
      saveData,
    } as unknown as Plugin);
    await store.load();
    const receive = vi.fn();
    const unregister = log.register({ receive });
    try {
      const first = store.update((views) => addRule(views, 'One'));
      const secondEdit = vi.fn((views: readonly ReturnType<typeof makeView>[]) =>
        addRule(views, 'Two'),
      );
      const second = store.update(secondEdit);
      await Promise.resolve();
      expect(saveData).toHaveBeenCalledTimes(1);
      expect(secondEdit).not.toHaveBeenCalled();
      rejectSave(new Error('disk full'));
      await Promise.all([first, second]);
      expect(receive).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: expect.stringContaining('disk full') as unknown,
        }),
      );
      expect(saveData).toHaveBeenCalledTimes(2);
      expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(['One', 'Two']);
      expect(saveData.mock.calls[0]?.[0].views[0]?.rules).toHaveLength(1);
      expect(saveData.mock.calls[1]?.[0].views[0]?.rules).toHaveLength(2);
    } finally {
      unregister();
    }
  });

  it('rejects a throwing edit without poisoning the next queued operation', async () => {
    const { plugin, writes } = fakePlugin({ views: [makeView('markdown')] });
    const store = new RuleStore(plugin);
    await store.load();
    const failure = new Error('invalid edit');
    const first = store.update(() => {
      throw failure;
    });
    const rejected = expect(first).rejects.toBe(failure);
    const next = store.update((views) => addRule(views, 'Recovered'));
    await rejected;
    await next;
    expect(writes).toHaveLength(1);
    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(['Recovered']);
  });

  it('propagates an unreadable file error instead of presenting an empty successful load', async () => {
    const failure = new Error('permission denied');
    const saveData = vi.fn();
    const store = new RuleStore({
      loadData: () => Promise.reject(failure),
      saveData,
    } as unknown as Plugin);
    await expect(store.load()).rejects.toBe(failure);
    expect(saveData).not.toHaveBeenCalled();
  });
});

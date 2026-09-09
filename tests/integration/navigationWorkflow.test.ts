/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App, Plugin, ViewState } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextWatcher } from '../../src/services/ContextWatcher';
import { CommandHandler } from '../../src/services/handlers/CommandHandler';
import { RuleRunner } from '../../src/services/RuleRunner';
import { RuleStore } from '../../src/services/RuleStore';
import { TraceService } from '../../src/services/TraceService';
import { type PluginData, SCHEMA_VERSION, type ViewRules } from '../../src/types/rule';
import { commandStep, group, localApp, makeRule, makeView, path } from '../factories';

type Leaf = { getViewState(): ViewState };
type WorkspaceEvent = 'active-leaf-change' | 'layout-change';
type Subscription = { event: WorkspaceEvent; callback: (leaf: Leaf | null) => void };

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, resolve: () => release?.() };
}

/** Only Obsidian's workspace, command dispatcher and plugin data file are replaced. */
async function workflow(views: ViewRules[]) {
  const subscriptions = new Set<Subscription>();
  const cleanups: (() => void)[] = [];
  let active: Leaf | null = null;
  let layoutReady: (() => void) | undefined;
  const writes: PluginData[] = [];
  const saveData = vi.fn(async (data: PluginData) => {
    writes.push(structuredClone(data));
  });
  const executed = vi.fn((_id: string) => true);
  const readFile = vi.fn();
  const workspace = {
    getMostRecentLeaf: vi.fn(() => active),
    on(event: WorkspaceEvent, callback: Subscription['callback']): Subscription {
      const subscription = { event, callback };
      subscriptions.add(subscription);
      return subscription;
    },
    onLayoutReady(callback: () => void): void {
      layoutReady = callback;
    },
  };
  // Full host types contain UI and vault APIs this workflow never reaches.
  const app = {
    workspace,
    commands: {
      findCommand: (id: string) => ({ id, name: `Command ${id}` }),
      executeCommandById: executed,
    },
    vault: { getFileByPath: () => null, read: readFile },
    metadataCache: { getFileCache: () => null },
  } as unknown as App;
  const plugin = {
    app,
    loadData: async () => ({ schemaVersion: SCHEMA_VERSION, views }),
    saveData,
    register: (cleanup: () => void) => {
      cleanups.push(cleanup);
    },
    registerEvent: (subscription: Subscription) => {
      cleanups.push(() => subscriptions.delete(subscription));
    },
    unload: () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  } as unknown as Plugin;
  const store = new RuleStore(plugin);
  await store.load();
  const trace = new TraceService(localApp());
  trace.setRecording(true);
  const watcher = new ContextWatcher(plugin);
  const runner = new RuleRunner(app, () => store, trace, [new CommandHandler(app)]);
  plugin.register(runner.listen(watcher));
  watcher.start();

  function emit(event: WorkspaceEvent): void {
    for (const subscription of subscriptions) {
      if (subscription.event === event) subscription.callback(active);
    }
  }
  function navigate(viewType: string, file: string): void {
    active = { getViewState: () => ({ type: viewType, state: { file } }) };
    emit('active-leaf-change');
    emit('layout-change');
  }
  return {
    store,
    trace,
    watcher,
    executed,
    readFile,
    writes,
    saveData,
    navigate,
    emit,
    ready: () => layoutReady?.(),
    shutdown: () => plugin.unload(),
    subscriptions,
    readLeaf: workspace.getMostRecentLeaf,
  };
}

afterEach(() => {});

describe('navigation through collaborating services', () => {
  it('coalesces duplicate workspace wakes, scopes views and traces a blank draft as rejected', async () => {
    const flow = await workflow([
      makeView('markdown', [
        makeRule({
          id: 'draft',
          name: 'Draft',
          when: group('and', path('contains', '')),
          steps: [commandStep('draft')],
        }),
        makeRule({
          id: 'note',
          name: 'Notes',
          when: group('and', path('inFolder', 'Notes')),
          steps: [commandStep('note')],
        }),
      ]),
      makeView('bases', [makeRule({ name: 'Bases', steps: [commandStep('base')] })]),
    ]);

    flow.navigate('markdown', 'Notes/First.md');
    flow.ready();
    flow.navigate('markdown', 'Notes/First.md');
    expect(flow.executed.mock.calls).toEqual([['note']]);
    expect(flow.trace.list()).toHaveLength(1);
    expect(flow.trace.list()[0]).toMatchObject({
      kind: 'trace',
      context: { viewType: 'markdown', path: 'Notes/First.md' },
      rules: [
        { rule: 'Draft', matched: false, steps: [] },
        { rule: 'Notes', matched: true, steps: ['ran Command note'] },
      ],
    });

    flow.navigate('bases', 'Notes/Board.base');
    expect(flow.executed.mock.calls).toEqual([['note'], ['base']]);
    expect(flow.trace.list()[0]).toMatchObject({ rules: [{ rule: 'Bases', matched: true }] });
    expect(flow.readFile).not.toHaveBeenCalled();
    expect(flow.saveData).not.toHaveBeenCalled();
    flow.shutdown();
  });

  it('uses the latest saved rule on the next navigation without replacing the runner', async () => {
    const flow = await workflow([
      makeView('markdown', [makeRule({ name: 'Original', steps: [commandStep('old')] })]),
    ]);
    flow.navigate('markdown', 'Notes/First.md');
    await flow.store.update((views) =>
      views.map((view) => ({
        ...view,
        rules: view.rules.map((rule) => ({
          ...rule,
          name: 'Edited',
          when: group('and', path('inFolder', 'New')),
          steps: [commandStep('new')],
        })),
      })),
    );

    flow.navigate('markdown', 'Notes/Second.md');
    expect(flow.executed.mock.calls).toEqual([['old']]);
    expect(flow.trace.list()[0]).toMatchObject({ rules: [{ rule: 'Edited', matched: false }] });
    flow.navigate('markdown', 'New/Third.md');
    expect(flow.executed.mock.calls).toEqual([['old'], ['new']]);
    expect(flow.writes[0]?.views[0]?.rules[0]?.name).toBe('Edited');
    expect(flow.trace.list()[0]).toMatchObject({ rules: [{ rule: 'Edited', matched: true }] });
    flow.shutdown();
  });

  it('serializes overlapping saves and runs the composed final rule after both finish', async () => {
    const flow = await workflow([
      makeView('markdown', [makeRule({ name: 'Initial', steps: [commandStep('old')] })]),
    ]);
    const saving = deferred();
    const entered = deferred();
    flow.saveData.mockImplementationOnce(async (data) => {
      flow.writes.push(structuredClone(data));
      entered.resolve();
      await saving.promise;
    });
    const first = flow.store.update((views) =>
      views.map((view) => ({
        ...view,
        rules: view.rules.map((rule) => ({ ...rule, name: 'Renamed' })),
      })),
    );
    await entered.promise;
    const second = flow.store.update((views) =>
      views.map((view) => ({
        ...view,
        rules: view.rules.map((rule) => ({ ...rule, steps: [commandStep('latest')] })),
      })),
    );
    expect(flow.saveData).toHaveBeenCalledTimes(1);
    saving.resolve();
    await Promise.all([first, second]);

    expect(flow.writes).toHaveLength(2);
    expect(flow.writes[1]?.views[0]?.rules[0]).toMatchObject({
      name: 'Renamed',
      steps: [commandStep('latest')],
    });
    flow.navigate('markdown', 'Notes/After.md');
    expect(flow.executed.mock.calls).toEqual([['latest']]);
    expect(flow.trace.list()[0]).toMatchObject({ rules: [{ rule: 'Renamed', matched: true }] });
    flow.shutdown();
  });

  it('stops dispatching after shutdown even when layout-ready arrives late', async () => {
    const flow = await workflow([
      makeView('markdown', [makeRule({ steps: [commandStep('run')] })]),
    ]);
    flow.navigate('markdown', 'Notes/Before.md');
    expect(flow.executed).toHaveBeenCalledTimes(1); // Control: the subscription was armed.
    expect(flow.watcher.current()?.path).toBe('Notes/Before.md');
    flow.shutdown();
    expect(flow.subscriptions.size).toBe(0);
    expect(flow.watcher.current()).toBeNull();
    flow.readLeaf.mockClear();
    flow.navigate('markdown', 'Notes/After.md');
    flow.ready();
    expect(flow.readLeaf).not.toHaveBeenCalled();
    expect(flow.watcher.current()).toBeNull();
    expect(flow.executed).toHaveBeenCalledTimes(1);
    expect(flow.trace.list()).toHaveLength(1);
    flow.shutdown();
    expect(flow.subscriptions.size).toBe(0);
  });
});

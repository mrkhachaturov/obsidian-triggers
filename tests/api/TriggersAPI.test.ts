/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App, Command, PluginManifest, PluginSettingTab, ViewState } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../src/logging/log';
import TriggersPlugin from '../../src/main';
import type { Context } from '../../src/types/context';

const lifecycle = vi.hoisted(() => ({
  cleanups: [] as (() => void)[],
  commands: [] as Command[],
  tabs: [] as PluginSettingTab[],
  loadData: vi.fn<() => Promise<unknown>>(),
  saveData: vi.fn<(data: unknown) => Promise<void>>(),
}));

// Only the unavailable Obsidian host is replaced; all plugin services run together.
vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>();
  class Plugin {
    constructor(
      readonly app: App,
      readonly manifest: PluginManifest,
    ) {}

    loadData(): Promise<unknown> {
      return lifecycle.loadData();
    }

    saveData(data: unknown): Promise<void> {
      return lifecycle.saveData(data);
    }

    register(cleanup: () => void): void {
      lifecycle.cleanups.push(cleanup);
    }

    registerEvent(ref: { off: () => void }): void {
      this.register(ref.off);
    }

    addCommand(command: Command): void {
      lifecycle.commands.push(command);
    }

    addSettingTab(tab: PluginSettingTab): void {
      lifecycle.tabs.push(tab);
    }
  }
  return { ...actual, Plugin };
});

type Leaf = { getViewState(): ViewState };

class Workspace {
  private readonly listeners = new Map<string, Set<(leaf: Leaf | null) => void>>();
  private readonly readyCallbacks: (() => void)[] = [];
  private active: Leaf | null = null;

  on(event: string, callback: (leaf: Leaf | null) => void): { off: () => void } {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(callback);
    this.listeners.set(event, listeners);
    return {
      off: () => {
        listeners.delete(callback);
      },
    };
  }

  onLayoutReady(callback: () => void): void {
    this.readyCallbacks.push(callback);
  }

  getMostRecentLeaf(): Leaf | null {
    return this.active;
  }

  navigate(state: ViewState | null): void {
    this.active = state === null ? null : { getViewState: () => state };
    for (const callback of this.listeners.get('active-leaf-change') ?? []) callback(this.active);
    for (const callback of this.listeners.get('layout-change') ?? []) callback(this.active);
  }

  ready(): void {
    for (const callback of this.readyCallbacks.splice(0)) callback();
  }
}

function unload(): void {
  for (const cleanup of lifecycle.cleanups.splice(0).reverse()) cleanup();
}

function createPlugin(): { plugin: TriggersPlugin; workspace: Workspace } {
  const workspace = new Workspace();
  // The real App has no constructor outside Obsidian; retain the methods actually crossed.
  const app = { workspace } as unknown as App;
  const manifest: PluginManifest = {
    id: 'triggers',
    name: 'Triggers',
    author: 'Test',
    description: 'Test host',
    version: '0.0.0',
    minAppVersion: '1.13.0',
  };
  return { plugin: new TriggersPlugin(app, manifest), workspace };
}

beforeEach(() => {
  lifecycle.commands.length = 0;
  lifecycle.tabs.length = 0;
  lifecycle.loadData.mockResolvedValue(null);
  lifecycle.saveData.mockResolvedValue(undefined);
  window.localStorage.clear();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  unload();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('public plugin API', () => {
  it('exposes only version, context subscription and log access, safely before load', () => {
    const { plugin } = createPlugin();
    expect(Object.keys(plugin.api).sort()).toEqual([
      'context',
      'log',
      'onContextChange',
      'version',
    ]);
    expect(plugin.api.version).toBe(1);
    expect(plugin.api.context()).toBeNull();
    expect(plugin.api.log()).toEqual([]);
    const unsubscribe = plugin.api.onContextChange(vi.fn());
    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });

  it('publishes one current context per navigation and independently removes subscriptions', async () => {
    const { plugin, workspace } = createPlugin();
    await plugin.onload();
    const received: (Context | null)[] = [];
    const listener = vi.fn((context: Context | null) => {
      expect(plugin.api.context()).toEqual(context);
      received.push(context);
    });
    const other = vi.fn();
    const unsubscribe = plugin.api.onContextChange(listener);
    plugin.api.onContextChange(other);
    workspace.navigate({ type: 'markdown', state: { file: 'Notes/A.md' } });
    expect(received).toEqual([{ viewType: 'markdown', path: 'Notes/A.md', viewName: null }]);
    unsubscribe();
    unsubscribe();
    workspace.navigate(null);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenLastCalledWith(null);
    expect(other).toHaveBeenCalledTimes(2);
    expect(plugin.api.context()).toBeNull();
  });

  it('reads initial context when layout becomes ready without writing settings', async () => {
    const { plugin, workspace } = createPlugin();
    workspace.navigate({ type: 'bases', state: { file: 'Views.base', viewName: 'Board' } });
    await plugin.onload();
    expect(plugin.api.context()).toBeNull();
    const listener = vi.fn();
    plugin.api.onContextChange(listener);
    workspace.ready();
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      viewType: 'bases',
      path: 'Views.base',
      viewName: 'Board',
    });
    expect(lifecycle.loadData).toHaveBeenCalledOnce();
    expect(lifecycle.saveData).not.toHaveBeenCalled();
    expect(lifecycle.commands.map((command) => command.id)).toEqual(['run-here']);
    expect(lifecycle.tabs).toHaveLength(1);
  });

  it('returns fresh newest-first log snapshots and detaches the sink on unload', async () => {
    const { plugin } = createPlugin();
    await plugin.onload();
    const initial = plugin.api.log();
    log.send('message', 'First event');
    const first = plugin.api.log();
    log.send('message', 'Second event');
    expect(initial).toEqual([]);
    expect(first).toEqual([expect.objectContaining({ kind: 'report', message: 'First event' })]);
    expect(plugin.api.log().map((entry) => (entry.kind === 'report' ? entry.message : ''))).toEqual(
      ['Second event', 'First event'],
    );
    unload();
    log.send('message', 'After unload');
    expect(plugin.api.log()).toHaveLength(2);
  });

  it('checks command availability without executing and runs explicitly only with context', async () => {
    window.localStorage.setItem('triggers:recording', 'true');
    const { plugin, workspace } = createPlugin();
    await plugin.onload();
    const command = lifecycle.commands.find((entry) => entry.id === 'run-here');
    const check = command?.checkCallback;
    if (check === undefined) throw new Error('The run-here command must expose checkCallback');
    expect(check(true)).toBe(false);
    check(false);
    expect(plugin.api.log()).toEqual([]);
    workspace.navigate({ type: 'markdown', state: { file: 'Notes/A.md' } });
    expect(plugin.api.log()).toHaveLength(1);
    expect(check(true)).toBe(true);
    expect(plugin.api.log()).toHaveLength(1);
    check(false);
    expect(plugin.api.log()).toHaveLength(2);
    expect(plugin.api.log()[0]).toMatchObject({
      kind: 'trace',
      context: { viewType: 'markdown', path: 'Notes/A.md', viewName: null },
    });
  });

  it('does not deliver workspace events or a deferred ready callback after unload', async () => {
    const { plugin, workspace } = createPlugin();
    await plugin.onload();
    const listener = vi.fn();
    plugin.api.onContextChange(listener);
    workspace.navigate({ type: 'markdown', state: { file: 'Before.md' } });
    expect(listener).toHaveBeenCalledOnce();
    unload();
    workspace.navigate({ type: 'markdown', state: { file: 'After.md' } });
    workspace.ready();
    expect(listener).toHaveBeenCalledOnce();
  });
});

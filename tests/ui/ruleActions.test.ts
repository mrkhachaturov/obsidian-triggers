/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type {
  App,
  Plugin,
  SettingDefinitionItem,
  SettingDefinitionList,
  SettingDefinitionPage,
} from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../src/i18n';
import { RuleStore } from '../../src/services/RuleStore';
import { TraceService } from '../../src/services/TraceService';
import type { SettingsHost } from '../../src/types/host';
import type { Rule, Step } from '../../src/types/rule';
import { rulePage } from '../../src/ui/rulePage';
import { ChoiceSuggest, CommandSuggest } from '../../src/ui/suggesters';
import { editRule, findRule } from '../../src/utils/tree';
import { commandStep, group, localApp, makeContext, makeRule, makeView, path } from '../factories';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function fixture(steps: Step[] = []) {
  const rule = makeRule({ steps });
  const saveData = vi.fn<(value: unknown) => Promise<void>>().mockResolvedValue(undefined);
  const store = new RuleStore({
    loadData: () => Promise.resolve({ views: [makeView('markdown', [rule])] }),
    saveData,
  } as unknown as Plugin);
  await store.load();
  const pending: Promise<void>[] = [];
  const currentContext = vi.fn<() => ReturnType<typeof makeContext> | null>(() => makeContext());
  const runOne = vi.fn((_rule: Rule, _context: ReturnType<typeof makeContext>) => true);
  const host: SettingsHost = {
    app: {} as App,
    editor: store,
    steps: {
      intact: () => true,
      runOne,
      handler: () => ({
        kind: 'command',
        available: () => false,
        describe: (step) => (step.kind === 'command' ? step.commandId : step.choiceName),
        run: () => ({ ok: false, detail: '' }),
      }),
    },
    choices: { choices: () => [{ id: 'choice', name: 'Capture', type: 'Macro' }] },
    trace: new TraceService(localApp()),
    reader: { current: currentContext, onChange: () => () => undefined },
    version: 'test',
    refresh: () => undefined,
    change: (change) => {
      const result = store.update(change);
      pending.push(result);
      return result;
    },
  };
  return {
    host,
    store,
    saveData,
    runOne,
    currentContext,
    page: rulePage(host, 'markdown', findRule(store.views(), rule.id) ?? rule),
    saved: () => findRule(store.views(), rule.id),
    flush: async () => {
      await Promise.all(pending);
      await Promise.resolve();
    },
  };
}

function invoke(page: SettingDefinitionPage, name: string): void {
  const item = page.items?.find((entry) => 'name' in entry && entry.name === name);
  if (!item || !('action' in item) || typeof item.action !== 'function')
    throw new Error(`Missing action ${name}`);
  item.action(document.body.createDiv(), 0);
}

function list(page: SettingDefinitionPage): SettingDefinitionList {
  const item = page.items?.find((entry) => 'type' in entry && entry.type === 'list');
  if (!item || !('type' in item) || item.type !== 'list') throw new Error('Missing list');
  return item as SettingDefinitionList;
}

function clickText(text: string): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent === text,
  );
  if (!button) throw new Error(`Missing button ${text}`);
  button.click();
}

function childPage(item: SettingDefinitionItem | undefined): SettingDefinitionPage {
  if (!item || !('type' in item) || item.type !== 'page') throw new Error('Missing action page');
  return item;
}

describe('rule action persistence', () => {
  it('adds both action kinds through the native menu and preserves an edit made while choosing', async () => {
    const f = await fixture();
    let chooseCommand: ((command: { id: string; name: string }) => void) | null = null;
    vi.spyOn(CommandSuggest.prototype, 'open').mockImplementation(function (this: CommandSuggest) {
      chooseCommand = this.onChooseItem.bind(this);
    });
    vi.spyOn(ChoiceSuggest.prototype, 'open').mockImplementation(function (this: ChoiceSuggest) {
      const choice = this.getItems()[0];
      if (choice) this.onChooseItem(choice);
    });
    invoke(f.page, strings.actions.add);
    clickText(strings.actions.command);
    await f.store.update((views) =>
      editRule(views, 'r1', (rule) => ({ ...rule, name: 'Renamed meanwhile', stop: true })),
    );
    if (chooseCommand === null) throw new Error('Command picker did not open');
    (chooseCommand as (command: { id: string; name: string }) => void)({
      id: 'new',
      name: 'New command',
    });
    await f.flush();
    invoke(f.page, strings.actions.add);
    clickText(strings.actions.choice);
    await f.flush();
    expect(f.saved()).toMatchObject({
      name: 'Renamed meanwhile',
      stop: true,
      steps: [commandStep('new'), { kind: 'quickadd', choiceId: 'choice', choiceName: 'Capture' }],
    });
    expect(f.saveData).toHaveBeenLastCalledWith(
      expect.objectContaining({ views: f.store.views() }),
    );
  });

  it('replaces an unavailable action while preserving other rule fields', async () => {
    const f = await fixture([commandStep('removed'), commandStep('kept')]);
    vi.spyOn(CommandSuggest.prototype, 'open').mockImplementation(function (this: CommandSuggest) {
      this.onChooseItem({ id: 'replacement', name: 'Replacement' });
    });
    const action = childPage(list(f.page).items?.[0]);
    expect(typeof action.status === 'function' ? action.status() : action.status).toBe('warning');
    invoke(action, strings.actions.change);
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('replacement'), commandStep('kept')]);
  });

  it('replaces the originally selected action when its position changes while the picker is open', async () => {
    const f = await fixture([commandStep('original'), commandStep('other')]);
    let choose: ((command: { id: string; name: string }) => void) | null = null;
    vi.spyOn(CommandSuggest.prototype, 'open').mockImplementation(function (this: CommandSuggest) {
      choose = this.onChooseItem.bind(this);
    });
    const actions = list(f.page);
    invoke(childPage(actions.items?.[0]), strings.actions.change);
    actions.onReorder?.(0, 1);
    await f.flush();
    if (choose === null) throw new Error('Missing picker');
    (choose as (command: { id: string; name: string }) => void)({
      id: 'replacement',
      name: 'Replacement',
    });
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('other'), commandStep('replacement')]);
  });

  it('persists direct list reordering, deletion and whole-rule deletion', async () => {
    const f = await fixture([commandStep('a'), commandStep('b'), commandStep('c')]);
    const actions = list(f.page);
    actions.onReorder?.(0, 2);
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('b'), commandStep('c'), commandStep('a')]);
    actions.onDelete?.(1);
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('b'), commandStep('a')]);
    invoke(f.page, strings.rule.delete);
    await f.flush();
    expect(f.saved()).toBeNull();
    expect(f.store.views()).toHaveLength(1);
  });

  it('persists management modal callbacks and redraws their latest results', async () => {
    const f = await fixture([commandStep('a'), commandStep('b')]);
    invoke(f.page, strings.actions.edit);
    document.querySelector<HTMLButtonElement>(`[aria-label="${strings.manage.moveDown}"]`)?.click();
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('b'), commandStep('a')]);
    document.querySelector<HTMLButtonElement>(`[aria-label="${strings.manage.delete}"]`)?.click();
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('a')]);
    vi.spyOn(CommandSuggest.prototype, 'open').mockImplementation(function (this: CommandSuggest) {
      this.onChooseItem({ id: 'added', name: 'Added' });
    });
    clickText(strings.actions.addCommand);
    await f.flush();
    expect(f.saved()?.steps).toEqual([commandStep('a'), commandStep('added')]);
    expect(
      Array.from(document.querySelectorAll('.tr-manage-label')).map((el) => el.textContent),
    ).toEqual(['a', 'added']);
  });
});

describe('manual run guards', () => {
  it('does not run without context or when current conditions are incomplete', async () => {
    const f = await fixture([commandStep('a')]);
    f.currentContext.mockReturnValue(null);
    invoke(f.page, strings.actions.run);
    expect(f.runOne).not.toHaveBeenCalled();
    f.currentContext.mockReturnValue(makeContext());
    await f.store.update((views) =>
      editRule(views, 'r1', (rule) => ({ ...rule, when: group('and', path('is', '')) })),
    );
    invoke(f.page, strings.actions.run);
    expect(f.runOne).not.toHaveBeenCalled();
  });

  it('does not execute a deleted rule through an old page callback', async () => {
    const f = await fixture([commandStep('a')]);
    invoke(f.page, strings.rule.delete);
    await f.flush();
    invoke(f.page, strings.actions.run);
    expect(f.runOne).not.toHaveBeenCalled();
    const run = f.page.items?.find((item) => 'name' in item && item.name === strings.actions.run);
    expect(run && 'disabled' in run && typeof run.disabled === 'function' && run.disabled()).toBe(
      true,
    );
  });

  it('uses the newest rule and handles both matched and not-matched runner outcomes', async () => {
    const f = await fixture([commandStep('a')]);
    await f.store.update((views) =>
      editRule(views, 'r1', (rule) => ({ ...rule, name: 'Current', steps: [commandStep('b')] })),
    );
    invoke(f.page, strings.actions.run);
    expect(f.runOne).toHaveBeenLastCalledWith(f.saved(), makeContext());
    f.runOne.mockReturnValue(false);
    invoke(f.page, strings.actions.run);
    expect(f.runOne).toHaveBeenCalledTimes(2);
    await f.store.update((views) => editRule(views, 'r1', (rule) => ({ ...rule, steps: [] })));
    invoke(f.page, strings.actions.run);
    expect(f.runOne).toHaveBeenCalledTimes(2);
  });
});

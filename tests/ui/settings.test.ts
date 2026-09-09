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
import type { PluginData, ViewRules } from '../../src/types/rule';
import { SCHEMA_VERSION } from '../../src/types/rule';
import { RECORDING_KEY } from '../../src/ui/diagnostics';
import { TriggersSettingTab } from '../../src/ui/settings';
import { ViewTypeSuggest } from '../../src/ui/suggesters';
import { viewTypes } from '../../src/ui/viewTypes';
import { write } from '../../src/utils/packageTransfer';
import { ruleKey } from '../../src/utils/ruleControls';
import { localApp, makeRule, makeView } from '../factories';

async function setup(
  views: ViewRules[] = [],
  registry?: Record<string, unknown>,
  save?: () => Promise<void>,
) {
  const writes: PluginData[] = [];
  const app = {
    ...(registry === undefined ? {} : { viewRegistry: { viewByType: registry } }),
  } as App;
  const plugin = {
    app,
    loadData: () => Promise.resolve({ schemaVersion: SCHEMA_VERSION, views }),
    saveData: (data: PluginData) => {
      writes.push(data);
      return save?.() ?? Promise.resolve();
    },
  } as unknown as Plugin;
  const store = new RuleStore(plugin);
  await store.load();
  const trace = new TraceService(localApp());
  const tab = new TriggersSettingTab(plugin, {
    editor: store,
    trace,
    version: '0.0.1',
    steps: { handler: () => undefined, intact: () => true, runOne: () => true },
    choices: { choices: () => [] },
    reader: { current: () => null, onChange: () => () => undefined },
  });
  return { tab, store, trace, writes };
}

function list(items: readonly SettingDefinitionItem[] | undefined): SettingDefinitionList {
  const found = items?.find(
    (item): item is SettingDefinitionList => 'type' in item && item.type === 'list',
  );
  if (found === undefined) throw new Error('Missing list');
  return found;
}

function page(tab: TriggersSettingTab, name: string): SettingDefinitionPage {
  const found = list(tab.getSettingDefinitions()).items?.find(
    (item) => 'name' in item && item.name === name,
  );
  if (found === undefined || !('type' in found) || found.type !== 'page')
    throw new Error(`Missing page ${name}`);
  return found;
}

function act(items: readonly SettingDefinitionItem[] | undefined, name: string): void {
  const found = items?.find((item) => 'name' in item && item.name === name);
  if (found === undefined || !('action' in found) || typeof found.action !== 'function')
    throw new Error(`Missing action ${name}`);
  found.action(document.body, 0);
}

function button(name: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent === name,
  );
  if (found === undefined) throw new Error(`Missing button ${name}`);
  return found;
}

function input(selector: string, value: string, event = 'input'): void {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    selector,
  );
  if (field === null) throw new Error(`Missing field ${selector}`);
  field.value = value;
  field.dispatchEvent(new Event(event, { bubbles: true }));
}

function library(tab: TriggersSettingTab): readonly SettingDefinitionItem[] {
  const group = tab
    .getSettingDefinitions()
    .find((item) => 'heading' in item && item.heading === strings.library.heading);
  if (group === undefined || !('items' in group)) throw new Error('Missing library');
  return group.items ?? [];
}

async function saved(writes: readonly PluginData[], count: number): Promise<void> {
  await vi.waitFor(() => expect(writes).toHaveLength(count));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('settings and persisted rule controls', () => {
  it('edits only the addressed rule and refreshes controls without rebuilding the focused page', async () => {
    const first = makeRule({ id: 'a', name: 'First' });
    const other = makeRule({ id: 'b', name: 'Other' });
    const { tab, store, writes } = await setup([
      makeView('markdown', [first]),
      makeView('canvas', [other]),
    ]);
    const update = vi.spyOn(tab, 'update');
    const refresh = vi.spyOn(tab, 'refreshDomState');
    await tab.setControlValue(ruleKey('a', 'name'), 'Renamed');
    await tab.setControlValue(ruleKey('a', 'enabled'), false);
    await tab.setControlValue(ruleKey('a', 'stop'), true);
    expect(tab.getControlValue(ruleKey('a', 'name'))).toBe('Renamed');
    expect(tab.getControlValue(ruleKey('a', 'enabled'))).toBe(false);
    expect(tab.getControlValue(ruleKey('a', 'stop'))).toBe(true);
    expect(store.views()[1]?.rules).toEqual([other]);
    expect(writes).toHaveLength(3);
    expect(update).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('ignores unknown keys and refuses values of the wrong type', async () => {
    const rule = makeRule();
    const { tab, store, writes } = await setup([makeView('markdown', [rule])]);
    for (const key of ['', '/name', 'r1/unknown', 'r1/name/extra', 'recording/unknown']) {
      expect(tab.getControlValue(key)).toBeUndefined();
      await tab.setControlValue(key, 'bad');
    }
    expect(writes).toEqual([]);
    for (const [key, value] of [
      [ruleKey('r1', 'name'), false],
      [ruleKey('r1', 'enabled'), 'false'],
      [ruleKey('r1', 'stop'), null],
    ] as const) {
      await tab.setControlValue(key, value);
    }
    expect(store.views()[0]?.rules).toEqual([rule]);
    expect(tab.getControlValue('deleted/name')).toBeUndefined();
    await tab.setControlValue('deleted/name', 'No resurrected rule');
    expect(store.views()[0]?.rules).toEqual([rule]);
  });

  it('changes device recording without writing vault rules', async () => {
    const { tab, trace, writes } = await setup();
    expect(tab.getControlValue(RECORDING_KEY)).toBe(false);
    await tab.setControlValue(RECORDING_KEY, true);
    expect(trace.recording).toBe(true);
    await tab.setControlValue(RECORDING_KEY, 'false');
    expect(trace.recording).toBe(true);
    await tab.setControlValue(RECORDING_KEY, false);
    expect(tab.getControlValue(RECORDING_KEY)).toBe(false);
    expect(writes).toEqual([]);
  });

  it('creates a named rule without implicit conditions and rebuilds the latest count', async () => {
    const { tab, store, writes } = await setup([makeView('markdown')]);
    const update = vi.spyOn(tab, 'update');
    list(page(tab, 'Markdown').items).addItem?.action(document.body);
    input('input', '   ');
    button(strings.naming.create).click();
    expect(writes).toEqual([]);
    input('input', '  My rule  ');
    button(strings.naming.create).click();
    await saved(writes, 1);
    expect(store.views()[0]?.rules[0]).toMatchObject({
      name: 'My rule',
      enabled: true,
      when: { kind: 'group', children: [] },
      steps: [],
    });
    const view = page(tab, 'Markdown');
    expect(typeof view.displayValue === 'function' ? view.displayValue() : view.displayValue).toBe(
      '1 rule',
    );
    expect(update).toHaveBeenCalledOnce();
    expect(document.querySelector('input')).toBeNull();
  });

  it('reorders and deletes rules within their view, then deletes only that view', async () => {
    const a = makeRule({ id: 'a' });
    const b = makeRule({ id: 'b' });
    const other = makeView('canvas', [makeRule({ id: 'other' })]);
    const { tab, store, writes } = await setup([makeView('markdown', [a, b]), other]);
    const rules = list(page(tab, 'Markdown').items);
    rules.onReorder?.(0, 1);
    await saved(writes, 1);
    expect(store.views()[0]?.rules.map((rule) => rule.id)).toEqual(['b', 'a']);
    list(page(tab, 'Markdown').items).onDelete?.(0);
    await saved(writes, 2);
    expect(store.views()[0]?.rules).toEqual([a]);
    act(page(tab, 'Markdown').items, strings.views.delete);
    await saved(writes, 3);
    expect(store.views()).toEqual([other]);
    expect(list(tab.getSettingDefinitions()).items).toHaveLength(1);
  });

  it('offers supported registered document types once and saves their technical IDs', async () => {
    const { tab, store, writes } = await setup([makeView('markdown')], {
      custom: {},
      markdown: {},
      bases: {},
      excalidraw: {},
    });
    const offered: ViewTypeSuggest[] = [];
    vi.spyOn(ViewTypeSuggest.prototype, 'open').mockImplementation(function (
      this: ViewTypeSuggest,
    ) {
      offered.push(this);
    });
    list(tab.getSettingDefinitions()).addItem?.action(document.body);
    expect(offered[offered.length - 1]?.getItems()).toEqual(['bases', 'excalidraw']);
    offered[offered.length - 1]?.onChooseItem('excalidraw');
    await saved(writes, 1);
    expect(store.views().map((view) => view.viewType)).toEqual(['markdown', 'excalidraw']);
    list(tab.getSettingDefinitions()).addItem?.action(document.body);
    expect(offered[offered.length - 1]?.getItems()).toEqual(['bases']);
  });

  it('manages names, order and deletion through the rule list dialog', async () => {
    const other = makeView('canvas', [makeRule({ id: 'other', name: 'Untouched' })]);
    const { tab, store, writes } = await setup([
      makeView('markdown', [
        makeRule({ id: 'a', name: 'First' }),
        makeRule({ id: 'b', name: 'Second' }),
      ]),
      other,
    ]);
    act(page(tab, 'Markdown').items, strings.rules.edit);
    input('.tr-manage-name', 'Renamed', 'change');
    await saved(writes, 1);
    document
      .querySelector<HTMLButtonElement>(`button[aria-label="${strings.manage.moveDown}"]`)
      ?.click();
    await saved(writes, 2);
    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(['Second', 'Renamed']);
    document
      .querySelector<HTMLButtonElement>(`button[aria-label="${strings.manage.delete}"]`)
      ?.click();
    await saved(writes, 3);
    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(['Renamed']);
    button(strings.rules.newRule).click();
    const fields = document.querySelectorAll<HTMLInputElement>('input');
    const field = fields[fields.length - 1];
    if (field === undefined) throw new Error('Missing new rule name');
    field.value = 'Added from manager';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    button(strings.naming.create).click();
    await saved(writes, 4);
    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual([
      'Renamed',
      'Added from manager',
    ]);
    expect(store.views()[1]).toEqual(other);
  });

  it('saves view reordering without changing the rules inside the views', async () => {
    const markdown = makeView('markdown', [makeRule()]);
    const canvas = makeView('canvas');
    const { tab, store, writes } = await setup([markdown, canvas]);
    list(tab.getSettingDefinitions()).onReorder?.(0, 1);
    await saved(writes, 1);
    expect(store.views()).toEqual([canvas, markdown]);
    expect(
      list(tab.getSettingDefinitions()).items?.map((item) => ('name' in item ? item.name : '')),
    ).toEqual(['Canvas', 'Markdown']);
  });

  it('does not open an empty picker when every registered view already exists', async () => {
    const { tab, writes } = await setup([makeView('markdown')], { markdown: {} });
    const open = vi.spyOn(ViewTypeSuggest.prototype, 'open');
    list(tab.getSettingDefinitions()).addItem?.action(document.body);
    expect(open).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});

describe('settings import and export through real dialogs', () => {
  it('exports latest saved rules rather than the state when settings opened', async () => {
    const { tab, store } = await setup();
    const actions = library(tab);
    await store.update(() => [makeView('markdown', [makeRule({ name: 'Latest' })])]);
    act(actions, strings.library.export);
    const box = document.querySelector('textarea');
    expect(box?.readOnly).toBe(true);
    expect(box?.value).toContain('Latest');
    const exported: unknown = JSON.parse(box?.value ?? '{}');
    expect(exported).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      pluginVersion: '0.0.1',
      views: store.views(),
    });
  });

  it('does not import malformed text or an empty package', async () => {
    const { tab, store, writes } = await setup([makeView('markdown')]);
    act(library(tab), strings.library.import);
    for (const value of ['broken json', write([], '0.0.1')]) {
      input('textarea', value);
      button(strings.library.import).click();
      expect(writes).toEqual([]);
      expect(document.querySelector('textarea')).not.toBeNull();
    }
    expect(store.views().map((view) => view.viewType)).toEqual(['markdown']);
  });

  it('preserves a queued edit when import waits behind an unfinished save', async () => {
    let release: () => void = () => undefined;
    const pendingSave = new Promise<void>((resolve) => {
      release = resolve;
    });
    let saveCount = 0;
    const { tab, store, writes } = await setup(
      [makeView('markdown', [makeRule({ id: 'old', name: 'Old' })])],
      undefined,
      () => (++saveCount === 1 ? pendingSave : Promise.resolve()),
    );
    act(library(tab), strings.library.import);
    input(
      'textarea',
      write([makeView('markdown', [makeRule({ id: 'incoming', name: 'Incoming' })])], '0.0.1'),
    );
    input('select', 'merge', 'change');
    const first = store.update((views) => [...views, makeView('canvas')]);
    await saved(writes, 1);
    const rename = tab.setControlValue(ruleKey('old', 'name'), 'Edited while saving');
    button(strings.library.import).click();
    release();
    await first;
    await rename;
    await saved(writes, 3);
    expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual([
      'Edited while saving',
      'Incoming',
    ]);
    expect(store.views().map((view) => view.viewType)).toEqual(['markdown', 'canvas']);
  });

  it.each(['replace', 'merge', 'skip'] as const)(
    'applies %s at confirmation against latest rules and refreshes settings',
    async (conflict) => {
      const { tab, store, writes } = await setup([
        makeView('markdown', [makeRule({ id: 'old', name: 'Old' })]),
      ]);
      const update = vi.spyOn(tab, 'update');
      act(library(tab), strings.library.import);
      input(
        'textarea',
        write(
          [
            makeView('markdown', [makeRule({ id: 'incoming', name: 'Incoming' })]),
            makeView('canvas'),
          ],
          '0.0.1',
        ),
      );
      input('select', conflict, 'change');
      await store.update((views) => [...views, makeView('pdf')]);
      button(strings.library.import).click();
      await saved(writes, 2);
      expect(store.views().map((view) => view.viewType)).toEqual(['markdown', 'pdf', 'canvas']);
      expect(store.views()[0]?.rules.map((rule) => rule.name)).toEqual(
        conflict === 'replace'
          ? ['Incoming']
          : conflict === 'merge'
            ? ['Old', 'Incoming']
            : ['Old'],
      );
      expect(update).toHaveBeenCalledOnce();
      expect(document.querySelector('textarea')).toBeNull();
    },
  );
});

// The picker is intentionally curated now; registry entries are availability, not options.
describe('supported document types', () => {
  it('falls back to the three built-ins without assuming Excalidraw is installed', () => {
    for (const registry of [undefined, null, []]) {
      expect(viewTypes({ viewRegistry: { viewByType: registry } } as unknown as App)).toEqual([
        'markdown',
        'canvas',
        'bases',
      ]);
    }
    expect(viewTypes({} as App)).toEqual(['markdown', 'canvas', 'bases']);
  });

  it('excludes service panels and other file viewers even when registered', () => {
    expect(
      viewTypes({
        viewRegistry: {
          viewByType: {
            search: {},
            backlink: {},
            'file-explorer': {},
            pdf: {},
            image: {},
            excalidraw: {},
            bases: {},
            canvas: {},
            markdown: {},
            custom: {},
          },
        },
      } as unknown as App),
    ).toEqual(['markdown', 'canvas', 'bases', 'excalidraw']);
    expect(viewTypes({ viewRegistry: { viewByType: {} } } as unknown as App)).toEqual([]);
  });

  it('checks availability again after a plugin is enabled or disabled', () => {
    const registered: Record<string, unknown> = { markdown: {}, canvas: {}, bases: {} };
    const app = { viewRegistry: { viewByType: registered } } as unknown as App;
    expect(viewTypes(app)).toEqual(['markdown', 'canvas', 'bases']);
    registered.excalidraw = {};
    expect(viewTypes(app)).toEqual(['markdown', 'canvas', 'bases', 'excalidraw']);
    delete registered.excalidraw;
    expect(viewTypes(app)).toEqual(['markdown', 'canvas', 'bases']);
  });
});

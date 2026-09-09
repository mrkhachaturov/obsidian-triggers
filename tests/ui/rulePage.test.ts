/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import {
  type App,
  Setting,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
} from 'obsidian';
import { describe, expect, it } from 'vitest';
import { strings } from '../../src/i18n';
import type { IStepHandler } from '../../src/interfaces/IStepHandler';
import type { SettingsHost } from '../../src/types/host';
import type { Rule, ViewRules } from '../../src/types/rule';
import { rulePage } from '../../src/ui/rulePage';
import { group, makeRule, makeView, path } from '../factories';

/* The screen is where every defect has been found so far, and none of them were
 * reachable from a test. These read the definitions the framework is handed. */

function makeHost(views: ViewRules[]): SettingsHost {
  const handler: IStepHandler = {
    kind: 'command',
    available: () => true,
    describe: () => 'Switch layout',
    run: () => ({ ok: true, detail: '' }),
  };

  return {
    app: {} as App,
    editor: { views: () => views, update: () => Promise.resolve() },
    steps: { handler: () => handler, intact: () => true, runOne: () => true },
    choices: { choices: () => [] },
    trace: {
      recording: false,
      setRecording: () => undefined,
      list: () => [],
      clear: () => undefined,
      onChange: () => () => undefined,
    },
    reader: { current: () => null, onChange: () => () => undefined },
    version: '0.0.1',
    change: () => Promise.resolve(),
    refresh: () => undefined,
  };
}

function pageFor(rule: Rule, viewType = 'markdown'): SettingDefinitionPage {
  return rulePage(makeHost([makeView(viewType, [rule])]), viewType, rule);
}

function labels(items: readonly SettingDefinitionItem[] | undefined): string[] {
  return (items ?? []).map((item) => {
    if ('heading' in item && item.heading !== undefined) return item.heading;
    return 'name' in item ? item.name : '';
  });
}

describe('the rule page', () => {
  it('holds the sections and rows a rule is edited from', () => {
    expect(labels(pageFor(makeRule()).items)).toEqual([
      '',
      'Conditions',
      'Actions',
      strings.actions.add,
      strings.rule.stop,
      'Run this rule now',
      'Delete rule',
    ]);
  });

  /* The connective is a word between two rows, not a control at the bottom of
   * the list, which is where it started and where nobody could tell what it
   * applied to. */
  it('has no separate row asking how the conditions are read', () => {
    expect(labels(pageFor(makeRule()).items)).not.toContain('Match');
  });

  it('names the rule, and says what it is waiting for', () => {
    const rule = makeRule({ name: 'Kanban', when: group('and', path('inFolder', 'Atlas')) });
    const page = pageFor(rule);

    expect(page.name).toBe('Kanban');
    expect(page.desc).toBe('1 condition');
  });
});

describe('the When section', () => {
  function whenSection(rule: Rule): SettingDefinitionItem {
    const found = pageFor(rule).items?.find(
      (item) => 'heading' in item && item.heading === 'Conditions',
    );
    if (found === undefined) throw new Error('no When section');
    return found;
  }

  /* One mount point: a condition is four controls on a line, which no
   * declarative definition can be, so the section draws itself. */
  it('is a single row that draws itself', () => {
    const section = whenSection(makeRule());
    const items = 'items' in section ? section.items : undefined;

    expect(items).toHaveLength(1);
    expect(items?.[0]).toHaveProperty('render');
  });

  it('mounts the editor into the row, and takes it down again', () => {
    const section = whenSection(makeRule());
    const item = ('items' in section ? section.items : [])?.[0];
    if (item === undefined || !('render' in item) || typeof item.render !== 'function') {
      throw new Error('the When section does not draw itself');
    }

    const setting = new Setting(document.body.createDiv());
    const unmount = item.render(setting, undefined as never);

    /* The instructions are on the screen, not in a file in the repository. */
    expect(setting.settingEl.textContent).toContain(strings.when.add);
    expect(typeof unmount).toBe('function');

    (unmount as () => void)();
    expect(setting.settingEl.textContent).toBe('');
  });
});

describe('rule summaries and action affordances', () => {
  it('describes scope, incomplete drafts and disabled state without raw expressions', () => {
    expect(pageFor(makeRule()).desc).toBe(strings.when.allMarkdown);
    expect(pageFor(makeRule(), 'canvas').desc).toBe(strings.when.allView);
    const draft = makeRule({ when: group('and', path('is', '')) });
    expect(pageFor(draft).desc).toBe(strings.when.incomplete);
    expect(pageFor({ ...draft, enabled: false }).desc).toBe(
      `${strings.rule.disabled} · ${strings.when.incomplete}`,
    );
    const nested = makeRule({ when: group('and', path('is', 'a'), group('or', path('is', 'b'))) });
    expect(pageFor(nested).desc).toBe('2 conditions');
  });

  it('reads the latest saved rule when the framework renders its summary again', () => {
    const rule = makeRule();
    const views = [makeView('markdown', [rule])];
    const page = rulePage(makeHost(views), 'markdown', rule);
    views[0] = makeView('markdown', [
      { ...rule, enabled: false, when: group('and', path('is', '')) },
    ]);
    expect(page.desc).toBe(`${strings.rule.disabled} · ${strings.when.incomplete}`);
    expect(typeof page.status === 'function' ? page.status() : page.status).toBe('warning');
  });

  it('only offers action management when there are actions', () => {
    expect(labels(pageFor(makeRule()).items)).not.toContain(strings.actions.edit);
    const page = pageFor(makeRule({ steps: [{ kind: 'command', commandId: 'x' }] }));
    expect(labels(page.items)).toContain(strings.actions.edit);
    const emptyValue = pageFor(makeRule()).displayValue;
    expect(typeof emptyValue === 'function' ? emptyValue() : emptyValue).toBe(
      strings.rule.runsNothing,
    );
  });

  it('disables manual execution for unfinished conditions, even with actions', () => {
    const rule = makeRule({
      when: group('and', path('is', '')),
      steps: [{ kind: 'command', commandId: 'x' }],
    });
    const page = pageFor(rule);
    const run = page.items?.find((item) => 'name' in item && item.name === strings.actions.run);
    expect(run).toBeDefined();
    expect(run && 'disabled' in run && typeof run.disabled === 'function' && run.disabled()).toBe(
      true,
    );
    expect(typeof page.status === 'function' ? page.status() : page.status).toBe('warning');
  });

  it('opens one action menu in the row document with both supported action kinds', () => {
    const page = pageFor(makeRule());
    const add = page.items?.find((item) => 'name' in item && item.name === strings.actions.add);
    const row = document.implementation.createHTMLDocument().body.createDiv();
    if (!add || !('action' in add) || typeof add.action !== 'function')
      throw new Error('Missing add action');
    add.action(row, 0);
    expect(
      Array.from(row.ownerDocument.querySelectorAll('[role=menuitem]')).map(
        (item) => item.textContent,
      ),
    ).toEqual([strings.actions.command, strings.actions.choice]);
  });
});

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import {
  Menu,
  type Setting,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
} from 'obsidian';
import { strings } from '../i18n';
import { count } from '../i18n/plural';
import { notify } from '../logging/sinks';

import type { SettingsHost } from '../types/host';
import type { Rule, Step } from '../types/rule';
import { conditionIncomplete, countConditions } from '../utils/conditionState';
import { ruleKey } from '../utils/ruleControls';
import { editRule, findRule, moveWithin, removeAt, removeRule } from '../utils/tree';
import { ManageListModal } from './manageModal';
import { mountIsland } from './mountIsland';
import { ChoiceSuggest, CommandSuggest } from './suggesters';
import { WhenEditor } from './WhenEditor';

const ICONS: Record<Step['kind'], string> = { command: 'terminal', quickadd: 'zap' };

/**
 * One rule: what it is called, what it matches, and what it runs.
 *
 * The entry says all three before it is opened - the condition in its description,
 * the number of actions beside it, and a warning when one of them points at
 * something that no longer exists.
 */
export function rulePage(host: SettingsHost, viewType: string, rule: Rule): SettingDefinitionPage {
  const current = (): Rule => findRule(host.editor.views(), rule.id) ?? rule;
  return {
    type: 'page',
    get name() {
      return current().name;
    },
    get desc() {
      return describeRule(current(), viewType);
    },
    displayValue: () => describeActions(current()),
    status: () =>
      host.steps.intact(current()) && !conditionIncomplete(current().when) ? null : 'warning',
    items: [
      {
        type: 'group',
        items: [
          { name: strings.rule.name, control: { type: 'text', key: ruleKey(rule.id, 'name') } },
          {
            name: strings.rule.enabled,
            desc: strings.rule.enabledDesc,
            control: { type: 'toggle', key: ruleKey(rule.id, 'enabled'), defaultValue: true },
          },
        ],
      },
      whenGroup(host, viewType, rule),
      actionsList(host, rule),
      { name: strings.actions.add, action: (el) => addAction(host, rule, el) },
      ...(rule.steps.length === 0
        ? []
        : [{ name: strings.actions.edit, action: () => manageActions(host, rule) }]),
      {
        name: strings.rule.stop,
        desc: strings.rule.stopDesc,
        control: { type: 'toggle', key: ruleKey(rule.id, 'stop'), defaultValue: false },
      },
      {
        name: strings.actions.run,
        desc: strings.actions.runDesc,
        action: () => {
          const latest = findRule(host.editor.views(), rule.id);
          if (latest !== null) runHere(host, latest);
        },
        disabled: () => {
          const latest = findRule(host.editor.views(), rule.id);
          return latest === null || latest.steps.length === 0 || conditionIncomplete(latest.when);
        },
      },
      {
        name: strings.rule.delete,
        action: () => void host.change((views) => removeRule(views, rule.id)),
      },
    ],
  };
}

function describeRule(rule: Rule, viewType: string): string {
  const total = countConditions(rule.when);
  const scope = conditionIncomplete(rule.when)
    ? strings.when.incomplete
    : total === 0 && rule.when.negated
      ? strings.when.emptyNegated
      : total > 0
        ? count(total, strings.when.count)
        : viewType === 'markdown'
          ? strings.when.allMarkdown
          : strings.when.allView;
  return rule.enabled ? scope : `${strings.rule.disabled} · ${scope}`;
}

function describeActions(rule: Rule): string {
  return rule.steps.length === 0
    ? strings.rule.runsNothing
    : count(rule.steps.length, strings.actions.count);
}

/**
 * The When section: a heading, and one row hosting the editor.
 *
 * The editor is a Preact island because a condition does not fit a declarative
 * definition - four controls on one line, and a `SettingDefinition` carries one.
 * It keeps its own state, so a dropdown redraws the section instead of the tab.
 */
function whenGroup(host: SettingsHost, viewType: string, rule: Rule): SettingDefinitionItem {
  return {
    type: 'group',
    heading: strings.when.heading,
    items: [
      {
        name: '',
        searchable: false,
        render: (setting: Setting) => mountWhen(host, viewType, rule, setting),
      },
    ],
  };
}

/* The row is a mount point, so it gives up the columns a setting row has: the
 * editor is a section, not a control beside a label. */
function mountWhen(host: SettingsHost, viewType: string, rule: Rule, setting: Setting): () => void {
  setting.settingEl.addClass('tr-when-host');
  setting.infoEl.remove();

  const mounted = mountIsland(
    setting.controlEl,
    <WhenEditor
      when={rule.when}
      viewType={viewType}
      onChange={(next) => {
        void host.editor.update((views) =>
          editRule(views, rule.id, (current) => ({ ...current, when: next })),
        );
      }}
    />,
    strings.when.heading,
  );

  /* Whatever mounts, unmounts: the framework tears the row down and tells us. */
  return () => mounted.destroy();
}

function actionsList(host: SettingsHost, rule: Rule): SettingDefinitionItem {
  return {
    type: 'list',
    heading: strings.actions.heading,
    emptyState: strings.actions.empty,
    onReorder: (from, to) => void withSteps(host, rule, (steps) => moveWithin(steps, from, to)),
    onDelete: (index) => void withSteps(host, rule, (steps) => removeAt(steps, index)),
    items: rule.steps.map((step) => actionPage(host, rule, step)),
  };
}

function actionPage(host: SettingsHost, rule: Rule, step: Step): SettingDefinitionPage {
  const target = describeStep(host, step);

  return {
    type: 'page',
    name: step.kind === 'command' ? strings.actions.command : strings.actions.choice,
    displayValue: () => target,
    status: () => (host.steps.handler(step.kind)?.available(step) === true ? null : 'warning'),
    items: [
      {
        name: strings.actions.change,
        desc: target,
        action: () => {
          pick(host, step.kind, (chosen) => replace(host, rule, step, chosen));
        },
      },
    ],
  };
}

function describeStep(host: SettingsHost, step: Step): string {
  const described = host.steps.handler(step.kind)?.describe(step) ?? '';
  return described.length > 0 ? described : strings.actions.notSet;
}

/* One dialog per row, so the list is where order, renaming and removal all are. */
function manageActions(host: SettingsHost, rule: Rule): void {
  const steps = (): readonly Step[] => findRule(host.editor.views(), rule.id)?.steps ?? [];

  new ManageListModal(host.app, strings.actions.heading, {
    list: () =>
      steps().map((step) => ({ label: describeStep(host, step), icon: ICONS[step.kind] })),
    move: (from, to) => withSteps(host, rule, (all) => moveWithin(all, from, to)),
    remove: (index) => withSteps(host, rule, (all) => removeAt(all, index)),
    empty: strings.actions.empty,
    buttons: [
      {
        label: strings.actions.addCommand,
        cta: false,
        onClick: (done) => {
          pick(host, 'command', (step) => void append(host, rule, step).then(done));
        },
      },
      {
        label: strings.actions.addChoice,
        cta: true,
        onClick: (done) => {
          pick(host, 'quickadd', (step) => void append(host, rule, step).then(done));
        },
      },
    ],
  }).open();
}

/* Asked here rather than by navigating away and coming back, which is the only
 * way to test a rule otherwise. */
function runHere(host: SettingsHost, rule: Rule): void {
  if (rule.steps.length === 0 || conditionIncomplete(rule.when)) return;
  const context = host.reader.current();
  if (context === null) {
    notify(strings.actions.nowhere, 'warning');
    return;
  }

  const ran = host.steps.runOne(rule, context);
  notify(ran ? strings.actions.ran : strings.actions.didNotMatch, ran ? 'success' : 'warning');
}

function addAction(host: SettingsHost, rule: Rule, el: HTMLElement): void {
  const menu = new Menu();
  for (const kind of ['command', 'quickadd'] as const) {
    menu.addItem((item) =>
      item
        .setTitle(kind === 'command' ? strings.actions.command : strings.actions.choice)
        .setIcon(ICONS[kind])
        .onClick(() => pick(host, kind, (step) => void append(host, rule, step))),
    );
  }
  const bounds = el.getBoundingClientRect();
  menu.showAtPosition({ x: bounds.left, y: bounds.bottom }, el.ownerDocument);
}

/* A fuzzy list, not a dropdown: a vault holds hundreds of commands. */
function pick(host: SettingsHost, kind: Step['kind'], onPick: (step: Step) => void): void {
  if (kind === 'command') {
    new CommandSuggest(host.app, (command) =>
      onPick({ kind: 'command', commandId: command.id }),
    ).open();
    return;
  }

  new ChoiceSuggest(host.app, host.choices.choices(), (choice) =>
    onPick({ kind: 'quickadd', choiceId: choice.id, choiceName: choice.name }),
  ).open();
}

function append(host: SettingsHost, rule: Rule, step: Step): Promise<void> {
  return withSteps(host, rule, (steps) => [...steps, step]);
}

function replace(host: SettingsHost, rule: Rule, target: Step, step: Step): void {
  // The picker can remain open while another settings window reorders the actions.
  void withSteps(host, rule, (steps) =>
    steps.map((current) => (current === target ? step : current)),
  );
}

function withSteps(
  host: SettingsHost,
  rule: Rule,
  change: (steps: readonly Step[]) => Step[],
): Promise<void> {
  return host.change((views) =>
    editRule(views, rule.id, (current) => ({ ...current, steps: change(current.steps) })),
  );
}

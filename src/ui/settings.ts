/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import {
  type Plugin,
  PluginSettingTab,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
} from 'obsidian';
import { strings } from '../i18n';
import { count } from '../i18n/plural';
import { notify } from '../logging/sinks';
import type { SettingsHost, SettingsServices } from '../types/host';
import { EMPTY_WHEN, newId, type Rule, type ViewRules } from '../types/rule';
import { readControl, readKey, writeControl } from '../utils/ruleControls';
import { editRule, findRule, findView, moveWithin, removeAt, withRules } from '../utils/tree';
import { diagnosticsGroup, RECORDING_KEY } from './diagnostics';
import { libraryGroup } from './library';
import { ManageListModal } from './manageModal';
import { rulePage } from './rulePage';
import { NameModal, ViewTypeSuggest } from './suggesters';
import { viewTypeName, viewTypes } from './viewTypes';

/**
 * The settings screen, declared rather than drawn. The tree is in docs/settings.md.
 *
 * The framework owns rendering, search and teardown; this class owns what the tree
 * contains and where a control's value comes from.
 */
export class TriggersSettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(plugin: Plugin, services: SettingsServices) {
    super(plugin.app, plugin);

    this.host = {
      ...services,
      app: plugin.app,
      change: (edit) => services.editor.update(edit).then(() => this.update()),
      refresh: () => this.update(),
    };
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [this.viewsList(), diagnosticsGroup(this.host), libraryGroup(this.host)];
  }

  override getControlValue(key: string): unknown {
    if (key === RECORDING_KEY) return this.host.trace.recording;

    const named = readKey(key);
    if (named === null) return undefined;

    const rule = findRule(this.host.editor.views(), named.ruleId);
    return rule === null ? undefined : readControl(rule, named.part);
  }

  override setControlValue(key: string, value: unknown): void | Promise<void> {
    if (key === RECORDING_KEY) {
      if (typeof value === 'boolean') this.host.trace.setRecording(value);
      return;
    }

    const named = readKey(key);
    if (named === null) return;

    return (
      this.host.editor
        .update((views) =>
          editRule(views, named.ruleId, (rule) => writeControl(rule, named.part, value)),
        )
        /* A toggle decides whether the rows under it are shown. Nothing is rebuilt:
         * the fields keep their text and the cursor stays where it was. */
        .then(() => this.refreshDomState())
    );
  }

  /**
   * The top level: one entry per view type, and no rules of its own.
   *
   * Creating one is choosing which view you are about to write rules for, so `+`
   * offers view types rather than asking for a name.
   */
  private viewsList(): SettingDefinitionItem {
    const views = this.host.editor.views();

    return {
      type: 'list',
      heading: strings.views.heading,
      emptyState: strings.views.empty,
      addItem: { name: strings.views.add, action: () => this.addView() },
      onReorder: (from, to) => void this.host.change((all) => moveWithin(all, from, to)),
      items: views.map((view) => this.viewPage(view)),
    };
  }

  private addView(): void {
    const taken = new Set(this.host.editor.views().map((view) => view.viewType));
    /* A view holds every rule for its type, so there is never a second one. */
    const offered = viewTypes(this.host.app).filter((type) => !taken.has(type));

    if (offered.length === 0) {
      notify(strings.views.allAdded, 'warning');
      return;
    }

    new ViewTypeSuggest(this.host.app, offered, (viewType) => {
      void this.host.change((views) => [...views, { id: newId(), viewType, rules: [] }]);
    }).open();
  }

  private viewPage(view: ViewRules): SettingDefinitionPage {
    return {
      type: 'page',
      name: viewTypeName(view.viewType),
      displayValue: () => count(view.rules.length, strings.views.ruleCount),
      items: [
        {
          type: 'list',
          heading: strings.rules.heading,
          emptyState: strings.rules.empty,
          addItem: { name: strings.rules.newRule, action: () => this.addRule(view.id) },
          onReorder: (from, to) => void this.rules(view.id, (rules) => moveWithin(rules, from, to)),
          onDelete: (index) => void this.rules(view.id, (rules) => removeAt(rules, index)),
          items: view.rules.map((rule) => rulePage(this.host, view.viewType, rule)),
        },
        ...(view.rules.length === 0
          ? []
          : [{ name: strings.rules.edit, action: () => this.manageRules(view.id) }]),
        {
          name: strings.views.delete,
          desc: strings.views.deleteDesc,
          action: () =>
            void this.host.change((views) => views.filter((entry) => entry.id !== view.id)),
        },
      ],
    };
  }

  private addRule(viewId: string, onDone: () => void = () => undefined): void {
    new NameModal(this.host.app, strings.naming.newRule, '', (name) => {
      void this.rules(viewId, (rules) => [...rules, newRule(name)]).then(onDone);
    }).open();
  }

  private manageRules(viewId: string): void {
    const rules = (): readonly Rule[] => findView(this.host.editor.views(), viewId)?.rules ?? [];

    new ManageListModal(this.host.app, strings.rules.heading, {
      list: () =>
        rules().map((rule) => ({ label: rule.name, icon: rule.enabled ? 'zap' : 'zap-off' })),
      rename: (index, name) =>
        this.rules(viewId, (all) =>
          all.map((rule, at) => (at === index ? { ...rule, name } : rule)),
        ),
      move: (from, to) => this.rules(viewId, (all) => moveWithin(all, from, to)),
      remove: (index) => this.rules(viewId, (all) => removeAt(all, index)),
      empty: strings.rules.empty,
      buttons: [
        { label: strings.rules.newRule, cta: true, onClick: (done) => this.addRule(viewId, done) },
      ],
    }).open();
  }

  private rules(
    viewId: string,
    change: (rules: readonly Rule[]) => readonly Rule[],
  ): Promise<void> {
    return this.host.change((views) => withRules(views, viewId, change));
  }
}

function newRule(name: string): Rule {
  return {
    id: newId(),
    name,
    enabled: true,
    trigger: { kind: 'context' },
    when: EMPTY_WHEN,
    steps: [],
    stop: false,
  };
}

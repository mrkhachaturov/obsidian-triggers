/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import {
  type ButtonComponent,
  Component,
  Setting,
  type SettingDefinitionGroup,
  SettingPage,
} from 'obsidian';
import { strings } from '../i18n';
import { count } from '../i18n/plural';
import type { ITraceLog } from '../interfaces/ITraceLog';
import type { SettingsHost } from '../types/host';
import type { LogEntry, RuleOutcome } from '../types/trace';

/** The key that is not a rule's: recording is a preference of this device. */
export const RECORDING_KEY = 'recording';

/** The page factory reads the log on open, including events recorded after settings opened. */
export function diagnosticsGroup(host: Pick<SettingsHost, 'trace'>): SettingDefinitionGroup {
  return {
    type: 'group',
    heading: strings.diagnostics.heading,
    items: [
      {
        name: strings.diagnostics.recording,
        desc: strings.diagnostics.recordingDesc,
        control: { type: 'toggle', key: RECORDING_KEY, defaultValue: false },
      },
      {
        type: 'page',
        name: strings.diagnostics.log,
        desc: strings.diagnostics.logDesc,
        displayValue: () => count(host.trace.list().length, strings.diagnostics.entries),
        page: () => new DiagnosticsPage(host.trace),
      },
    ],
  };
}

class DiagnosticsPage extends SettingPage {
  private lifetime: Component | null = null;
  private entriesEl: HTMLElement | null = null;
  private clearButton: ButtonComponent | null = null;

  constructor(private readonly trace: ITraceLog) {
    super();
    this.title = strings.diagnostics.log;
  }

  display(): void {
    this.dispose();
    this.containerEl.empty();
    new Setting(this.containerEl).setName(strings.diagnostics.recent).setHeading();
    this.entriesEl = this.containerEl.createDiv({ cls: 'tr-log-entries' });
    new Setting(this.containerEl).addButton((button) => {
      this.clearButton = button;
      button.setButtonText(strings.diagnostics.clear).onClick(() => this.trace.clear());
    });

    const lifetime = new Component();
    this.lifetime = lifetime;
    lifetime.load();
    lifetime.register(this.trace.onChange(() => this.renderEntries()));
    // A popout can be destroyed without SettingPage.hide being called.
    lifetime.registerDomEvent(this.containerEl.win, 'unload', () => this.dispose());
    this.renderEntries();
  }

  override hide(): void {
    this.dispose();
    super.hide();
  }

  private dispose(): void {
    this.lifetime?.unload();
    this.lifetime = null;
    this.entriesEl = null;
    this.clearButton = null;
  }

  private renderEntries(): void {
    const target = this.entriesEl;
    if (target === null) return;
    const entries = this.trace.list();
    target.empty();
    this.clearButton?.setDisabled(entries.length === 0);
    if (entries.length === 0) {
      new Setting(target).setName(strings.diagnostics.empty);
      return;
    }
    for (const entry of entries) renderEntry(target, entry);
  }
}

function renderEntry(target: HTMLElement, entry: LogEntry): void {
  const at = new Date(entry.at).toLocaleTimeString();
  const row = new Setting(target);
  if (entry.kind === 'report') {
    row.setName(`${at} · ${entry.level}`).setDesc(entry.message);
    return;
  }
  const context = entry.context;
  const where =
    context === null
      ? strings.diagnostics.nothingOpen
      : describeContext(context.viewType, context.path, context.viewName);
  row.setName(`${at} · ${where}`);
  renderLines(row.descEl, entry);
}

/* The log names the row that refused in the same words the row itself carries. */
function refused(missed: RuleOutcome['missed']): string {
  if (missed === undefined) return strings.diagnostics.noMatch;
  if (missed === 'any') return strings.condition.any;
  if (missed === 'disabled') return strings.rule.disabled;
  if (missed === 'trigger') return strings.diagnostics.noMatch;
  return strings.fields[missed];
}

function describeContext(viewType: string, path: string | null, viewName: string | null): string {
  return [viewType, path, viewName]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');
}

/* One line per rule that was looked at, and why it was or was not run. */
function renderLines(target: HTMLElement, entry: Extract<LogEntry, { kind: 'trace' }>): void {
  if (entry.rules.length === 0) {
    target.createDiv({ text: strings.diagnostics.noMatch });
    return;
  }
  for (const outcome of entry.rules) {
    if (!outcome.matched) {
      target.createDiv({ text: `${outcome.rule}: ${refused(outcome.missed)}` });
      continue;
    }
    const ran =
      outcome.steps.length === 0 ? strings.diagnostics.noActions : outcome.steps.join(', ');
    target.createDiv({ text: `${outcome.rule}: ${ran}` });
  }
  target.createDiv({
    text: `${entry.rules.length} ${strings.diagnostics.considered} · ${entry.elapsedMs} ms`,
  });
}

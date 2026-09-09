import { localApp } from '../factories';
/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { SettingDefinitionPage, SettingPage } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../src/i18n';
import { TraceService } from '../../src/services/TraceService';
import { diagnosticsGroup } from '../../src/ui/diagnostics';

const pages: SettingPage[] = [];
const frames: HTMLIFrameElement[] = [];

afterEach(() => {
  for (const page of pages.splice(0)) {
    page.hide();
    page.containerEl.remove();
  }
  for (const frame of frames.splice(0)) frame.remove();
  vi.restoreAllMocks();
});

function link(trace: TraceService): SettingDefinitionPage {
  const result = diagnosticsGroup({ trace }).items?.find(
    (item) => 'type' in item && item.type === 'page',
  );
  if (result === undefined || !('type' in result) || result.type !== 'page')
    throw new Error('Missing log page');
  return result;
}

function open(definition: SettingDefinitionPage, owner = document): SettingPage {
  const page = definition.page?.();
  if (page === undefined) throw new Error('Expected an on-open page factory');
  page.containerEl = owner.body.createDiv();
  pages.push(page);
  page.display();
  return page;
}

function record(trace: TraceService, name: string, at = 1): void {
  trace.record({
    at,
    context: { viewType: 'markdown', path: `${name}.md`, viewName: null },
    rules: [{ rule: name, matched: true, steps: [`run ${name}`] }],
    elapsedMs: 2,
  });
}

describe('diagnostics lifecycle', () => {
  it('opens entries that arrived after settings definitions were built', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const definition = link(trace); // Previously captured the empty array here.
    for (let i = 1; i <= 5; i += 1) record(trace, `event-${i}`, i);
    const page = open(definition);
    expect(
      typeof definition.displayValue === 'function'
        ? definition.displayValue()
        : definition.displayValue,
    ).toBe('5 entries');
    expect(page.containerEl.querySelectorAll('.tr-log-entries .setting-item')).toHaveLength(5);
    expect(page.containerEl.textContent).toContain('event-5.md');
    expect(page.containerEl.textContent).not.toContain(strings.diagnostics.empty);
  });

  it('updates the open page and keeps newest events first', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const page = open(link(trace));
    expect(page.containerEl.textContent).toContain(strings.diagnostics.empty);
    record(trace, 'first');
    record(trace, 'second', 2);
    const names = [...page.containerEl.querySelectorAll('.tr-log-entries .setting-item-name')].map(
      (el) => el.textContent,
    );
    expect(names[0]).toContain('second.md');
    expect(names[1]).toContain('first.md');
    expect(page.containerEl.textContent).not.toContain(strings.diagnostics.empty);
  });

  it('shows reports with recording off and renders untrusted messages as text', () => {
    const trace = new TraceService(localApp());
    const page = open(link(trace));
    trace.receive({ at: 1, level: 'error', message: '<img src=x onerror=alert(1)>' });
    expect(page.containerEl.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(page.containerEl.querySelector('img')).toBeNull();
  });

  it('explains unmatched rules, missing actions and contexts without a file', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const page = open(link(trace));
    trace.record({
      at: 1,
      context: { viewType: 'bases', path: 'Projects.base', viewName: 'Board' },
      rules: [
        { rule: 'Disabled', matched: false, missed: 'disabled', steps: [] },
        { rule: 'Wrong trigger', matched: false, missed: 'trigger', steps: [] },
        { rule: 'Path filter', matched: false, missed: 'path', steps: [] },
        { rule: 'Any filter', matched: false, missed: 'any', steps: [] },
        { rule: 'Unmatched', matched: false, steps: [] },
        { rule: 'No actions', matched: true, steps: [] },
      ],
      elapsedMs: 3,
    });
    const text = page.containerEl.textContent;
    expect(text).toContain('bases · Projects.base · Board');
    expect(text).toContain(`Disabled: ${strings.rule.disabled}`);
    expect(text).toContain(`Wrong trigger: ${strings.diagnostics.noMatch}`);
    expect(text).toContain(`Path filter: ${strings.fields.path}`);
    expect(text).toContain(`Any filter: ${strings.condition.any}`);
    expect(text).toContain(`Unmatched: ${strings.diagnostics.noMatch}`);
    expect(text).toContain(`No actions: ${strings.diagnostics.noActions}`);
    expect(text).toContain(`6 ${strings.diagnostics.considered} · 3 ms`);

    trace.record({ at: 2, context: null, rules: [], elapsedMs: 0 });
    expect(page.containerEl.textContent).toContain(strings.diagnostics.nothingOpen);
    trace.record({
      at: 3,
      context: { viewType: 'empty', path: null, viewName: null },
      rules: [],
      elapsedMs: 0,
    });
    const newest = page.containerEl.querySelector('.tr-log-entries .setting-item');
    expect(newest?.textContent).toContain('empty');
    expect(newest?.textContent).not.toContain('null');
  });

  it('clears entries through the UI and accepts new events afterwards', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    record(trace, 'before');
    const definition = link(trace);
    const page = open(definition);
    const button = page.containerEl.querySelector('button');
    if (button === null) throw new Error('Missing clear button');
    button.click();
    expect(trace.list()).toEqual([]);
    expect(page.containerEl.textContent).toContain(strings.diagnostics.empty);
    expect(button.disabled).toBe(true);
    record(trace, 'after');
    expect(page.containerEl.textContent).toContain('after.md');
    expect(page.containerEl.textContent).not.toContain('before.md');
    expect(button.disabled).toBe(false);
    expect(
      typeof definition.displayValue === 'function'
        ? definition.displayValue()
        : definition.displayValue,
    ).toBe('1 entry');
  });

  it('unsubscribes on hide and reads current data when reopened', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const definition = link(trace);
    const page = open(definition);
    page.hide();
    const read = vi.spyOn(trace, 'list');
    record(trace, 'hidden');
    expect(read).not.toHaveBeenCalled();
    page.display();
    expect(page.containerEl.textContent).toContain('hidden.md');
    page.hide();
    page.hide();
  });

  it('repeated display replaces the subscription instead of multiplying it', () => {
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const page = open(link(trace));
    page.display();
    const read = vi.spyOn(trace, 'list');
    record(trace, 'once');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('renders in the settings document and cleans up when its window closes', () => {
    const frame = document.body.createEl('iframe');
    frames.push(frame);
    const owner = frame.contentDocument;
    if (owner === null || owner.defaultView === null) throw new Error('Missing settings window');
    const win = owner.defaultView;
    for (const name of ['createDiv', 'createEl', 'createSpan', 'empty', 'win']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      if (descriptor === undefined) throw new Error(`Missing host helper ${name}`);
      Object.defineProperty(win.HTMLElement.prototype, name, descriptor);
    }
    const trace = new TraceService(localApp());
    trace.setRecording(true);
    const page = open(link(trace), owner);
    record(trace, 'popout');
    for (const element of page.containerEl.querySelectorAll('*'))
      expect(element.ownerDocument).toBe(owner);
    const read = vi.spyOn(trace, 'list');
    win.dispatchEvent(new win.Event('unload'));
    record(trace, 'closed');
    expect(read).not.toHaveBeenCalled();
  });
});

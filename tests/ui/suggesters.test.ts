/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App, Command, FuzzyMatch } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceSuggest, CommandSuggest, NameModal, ViewTypeSuggest } from '../../src/ui/suggesters';

const app = {} as App;
afterEach(() => document.body.replaceChildren());

describe('command picker', () => {
  it('reads the current registry so commands registered or removed after construction are reflected', () => {
    const original: Command = { id: 'one', name: 'One' };
    const commands: Record<string, Command> = { one: original };
    const choose = vi.fn();
    const picker = new CommandSuggest({ commands: { commands } } as unknown as App, choose);
    expect(picker.getItems()).toEqual([original]);
    delete commands.one;
    const replacement: Command = { id: 'two', name: 'Two' };
    commands.two = replacement;
    expect(picker.getItems()).toEqual([replacement]);
    picker.onChooseItem(replacement);
    expect(choose).toHaveBeenCalledExactlyOnceWith(replacement);
  });

  it('renders command names as literal text and only allocates an icon when one exists', () => {
    const picker = new CommandSuggest(app, () => undefined);
    const plain = document.body.createDiv();
    const command = { id: 'x', name: '<img src=x onerror=alert(1)>' };
    picker.renderSuggestion({ item: command } as FuzzyMatch<Command>, plain);
    expect(picker.getItemText(command)).toBe(command.name);
    expect(plain.textContent).toBe(command.name);
    expect(plain.querySelector('img')).toBeNull();
    expect(plain.querySelector('.suggestion-aux')).toBeNull();
    const decorated = document.body.createDiv();
    picker.renderSuggestion(
      { item: { ...command, icon: 'file' } } as FuzzyMatch<Command>,
      decorated,
    );
    expect(decorated.querySelector('.suggestion-flair')).not.toBeNull();
  });
});

describe('choice and view pickers', () => {
  it('distinguishes same-named choices by type and returns the chosen identity', () => {
    const items = [
      { id: 'a', name: 'Task', type: 'Macro' },
      { id: 'b', name: 'Task', type: '' },
    ];
    const choose = vi.fn();
    const picker = new ChoiceSuggest(app, items, choose);
    expect(picker.getItems().map((item) => picker.getItemText(item))).toEqual([
      'Task  ·  Macro',
      'Task',
    ]);
    picker.getItems().pop();
    expect(picker.getItems()).toHaveLength(2);
    const chosen = items[1];
    if (chosen === undefined) throw new Error('Missing fixture');
    picker.onChooseItem(chosen);
    expect(choose).toHaveBeenCalledExactlyOnceWith(chosen);
  });

  it('preserves only the offered view options and does not let list consumers mutate them', () => {
    const choose = vi.fn();
    const picker = new ViewTypeSuggest(app, ['markdown', 'custom-view'], choose);
    picker.getItems().splice(0, 1);
    expect(picker.getItems()).toEqual(['markdown', 'custom-view']);
    expect(picker.getItemText('custom-view')).toBe('custom-view');
    for (const [id, name] of [
      ['markdown', 'Markdown'],
      ['canvas', 'Canvas'],
      ['bases', 'Bases'],
      ['excalidraw', 'Excalidraw'],
    ] as const) {
      expect(picker.getItemText(id)).toBe(name);
    }
    picker.onChooseItem('custom-view');
    expect(choose).toHaveBeenCalledExactlyOnceWith('custom-view');
  });
});

describe('rule naming modal', () => {
  it('does not create an unnamed rule and accepts a trimmed name by Enter', () => {
    const submit = vi.fn();
    const modal = new NameModal(app, 'New rule', '', submit);
    modal.open();
    const input = modal.contentEl.querySelector('input');
    if (input === null) throw new Error('Missing name input');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(submit).not.toHaveBeenCalled();
    expect(modal.contentEl.querySelector('input')).toBe(input);
    input.value = '  Daily tasks  ';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(submit).toHaveBeenCalledExactlyOnceWith('Daily tasks');
    expect(modal.contentEl.children).toHaveLength(0);
  });

  it('submits the initial value by button and closing without submission creates nothing', () => {
    const submit = vi.fn();
    const modal = new NameModal(app, 'New rule', ' Default ', submit);
    modal.open();
    const button = modal.contentEl.querySelector('button');
    if (button === null) throw new Error('Missing create button');
    button.click();
    expect(submit).toHaveBeenCalledExactlyOnceWith('Default');
    const cancelled = new NameModal(app, 'New rule', 'Cancelled', submit);
    cancelled.open();
    cancelled.close();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(cancelled.contentEl.children).toHaveLength(0);
  });
});

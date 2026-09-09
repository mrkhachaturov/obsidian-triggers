/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import {
  type App,
  type Command,
  type FuzzyMatch,
  FuzzySuggestModal,
  Modal,
  Setting,
  setIcon,
} from 'obsidian';
import { strings } from '../i18n';
import type { QuickAddChoice } from '../services/handlers/QuickAddHandler';
import { viewTypeName } from './viewTypes';

const INSTRUCTIONS = [
  { command: '↑↓', purpose: strings.pickers.navigate },
  { command: '↵', purpose: strings.pickers.choose },
  { command: 'esc', purpose: strings.pickers.cancel },
];

/** A dropdown of every command in a vault is not a control, it is a scroll. */
export class CommandSuggest extends FuzzySuggestModal<Command> {
  constructor(
    app: App,
    private readonly onChoose: (command: Command) => void,
  ) {
    super(app);
    this.setPlaceholder(strings.pickers.command);
    this.setInstructions(INSTRUCTIONS);
  }

  getItems(): Command[] {
    return Object.values(this.app.commands.commands);
  }

  getItemText(command: Command): string {
    return command.name;
  }

  override renderSuggestion(match: FuzzyMatch<Command>, el: HTMLElement): void {
    el.addClass('mod-complex');
    el.createDiv({ cls: 'suggestion-content' }).createDiv({
      cls: 'suggestion-title',
      text: match.item.name,
    });

    const icon = match.item.icon;
    if (icon !== undefined) {
      setIcon(
        el.createDiv({ cls: 'suggestion-aux' }).createSpan({ cls: 'suggestion-flair' }),
        icon,
      );
    }
  }

  onChooseItem(command: Command): void {
    this.onChoose(command);
  }
}

export class ChoiceSuggest extends FuzzySuggestModal<QuickAddChoice> {
  constructor(
    app: App,
    private readonly items: readonly QuickAddChoice[],
    private readonly onChoose: (choice: QuickAddChoice) => void,
  ) {
    super(app);
    this.setPlaceholder(strings.pickers.choice);
    this.setInstructions(INSTRUCTIONS);
  }

  getItems(): QuickAddChoice[] {
    return [...this.items];
  }

  getItemText(choice: QuickAddChoice): string {
    return choice.type.length > 0 ? `${choice.name}  ·  ${choice.type}` : choice.name;
  }

  onChooseItem(choice: QuickAddChoice): void {
    this.onChoose(choice);
  }
}

/** Supported document types that have no rules yet. */
export class ViewTypeSuggest extends FuzzySuggestModal<string> {
  constructor(
    app: App,
    private readonly types: readonly string[],
    private readonly onChoose: (type: string) => void,
  ) {
    super(app);
    this.setPlaceholder(strings.pickers.viewType);
    this.setInstructions(INSTRUCTIONS);
  }

  getItems(): string[] {
    return [...this.types];
  }

  getItemText(type: string): string {
    return viewTypeName(type);
  }

  onChooseItem(type: string): void {
    this.onChoose(type);
  }
}

/** Names a new rule. Obsidian has no naming prompt of its own. */
export class NameModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private readonly title: string,
    initial: string,
    private readonly onSubmit: (name: string) => void,
  ) {
    super(app);
    this.value = initial;
  }

  override onOpen(): void {
    this.setTitle(this.title);

    new Setting(this.contentEl).setName(strings.naming.name).addText((text) =>
      text
        .setValue(this.value)
        .onChange((value) => {
          this.value = value;
        })
        .inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') this.submit();
        }),
    );

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText(strings.naming.create)
        .setCta()
        .onClick(() => this.submit()),
    );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  private submit(): void {
    const name = this.value.trim();
    if (name.length === 0) return;
    this.close();
    this.onSubmit(name);
  }
}

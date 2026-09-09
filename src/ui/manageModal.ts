/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { type App, Modal, setIcon } from 'obsidian';
import { strings } from '../i18n';
/* One modal holding the whole list, so rename, order and removal sit where the
 * order is visible. A row the user built has to be removable from that row: an
 * affordance that appears only on hover is not one a person finds. */

/** One row: what it is called, and the icon that says what kind it is. */
export interface ManageRow {
  readonly label: string;
  readonly icon: string;
}

export interface ManageActions {
  readonly list: () => readonly ManageRow[];
  /** Absent when the rows have no name of their own, as an action has none. */
  readonly rename?: (index: number, name: string) => Promise<void>;
  readonly move: (from: number, to: number) => Promise<void>;
  readonly remove: (index: number) => Promise<void>;
  readonly empty: string;
  readonly buttons: readonly {
    readonly label: string;
    readonly cta: boolean;
    readonly onClick: (done: () => void) => void;
  }[];
}

export class ManageListModal extends Modal {
  private listEl: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly title: string,
    private readonly actions: ManageActions,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(this.title);
    this.modalEl.addClass('tr-manage-modal');
    this.listEl = this.contentEl.createDiv({ cls: 'tr-manage-list' });
    this.renderRows();
    this.renderFooter();
  }

  override onClose(): void {
    this.modalEl.removeClass('tr-manage-modal');
    this.contentEl.empty();
    this.listEl = null;
  }

  private renderRows(): void {
    const list = this.listEl;
    if (list === null) return;
    list.empty();

    const entries = this.actions.list();
    if (entries.length === 0) {
      list.createDiv({ cls: 'tr-manage-empty', text: this.actions.empty });
      return;
    }

    const rename = this.actions.rename;

    entries.forEach((entry, index) => {
      const row = list.createDiv({ cls: 'tr-manage-row' });
      setIcon(row.createDiv({ cls: 'tr-manage-icon' }), entry.icon);

      if (rename === undefined) {
        row.createDiv({ cls: 'tr-manage-label', text: entry.label });
      } else {
        const input = row.createEl('input', {
          cls: 'tr-manage-name',
          attr: { type: 'text', value: entry.label },
        });
        input.addEventListener('change', () => {
          const name = input.value.trim();
          if (name.length > 0) void rename(index, name);
        });
      }

      this.iconButton(row, 'arrow-up', strings.manage.moveUp, index === 0, () =>
        this.after(this.actions.move(index, index - 1)),
      );
      this.iconButton(
        row,
        'arrow-down',
        strings.manage.moveDown,
        index === entries.length - 1,
        () => this.after(this.actions.move(index, index + 1)),
      );
      this.iconButton(row, 'trash', strings.manage.delete, false, () =>
        this.after(this.actions.remove(index)),
      );
    });
  }

  private renderFooter(): void {
    const footer = this.contentEl.createDiv({ cls: 'tr-manage-footer' });

    for (const button of this.actions.buttons) {
      footer
        .createEl(
          'button',
          button.cta ? { text: button.label, cls: 'mod-cta' } : { text: button.label },
        )
        .addEventListener('click', () => button.onClick(() => this.renderRows()));
    }
  }

  private iconButton(
    row: HTMLElement,
    icon: string,
    label: string,
    disabled: boolean,
    onClick: () => void,
  ): void {
    const button = row.createEl('button', { cls: 'clickable-icon tr-manage-action' });
    setIcon(button, icon);
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.addEventListener('click', onClick);
  }

  private after(work: Promise<void>): void {
    void work.then(() => this.renderRows());
  }
}

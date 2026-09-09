/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { type App, Modal, Setting } from 'obsidian';
import { strings } from '../i18n';
import { notify } from '../logging/sinks';
import type { ViewRules } from '../types/rule';
import { type Analysis, analyse, type Conflict } from '../utils/packageTransfer';

const FILE_TYPE = 'application/json;charset=utf-8';

/* A file is the thing people send each other; the clipboard is for the moment
 * you just want it in a message. Both, rather than either. */
function save(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: FILE_TYPE }));
  const link = activeDocument.body.createEl('a', { href: url, attr: { download: name } });
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export class ExportRulesModal extends Modal {
  constructor(
    app: App,
    private readonly text: string,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(strings.library.exportTitle);

    const box = this.contentEl.createEl('textarea', { cls: 'tr-transfer-text' });
    box.value = this.text;
    box.spellcheck = false;
    box.readOnly = true;

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(strings.library.copy).onClick(() => {
          void navigator.clipboard
            .writeText(this.text)
            .then(() => notify(strings.library.copied, 'success'));
        }),
      )
      .addButton((button) =>
        button
          .setButtonText(strings.library.save)
          .setCta()
          .onClick(() => {
            save(this.text, `triggers-rules-${stamp()}.json`);
            this.close();
          }),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}

export class ImportRulesModal extends Modal {
  private conflict: Conflict = 'replace';
  private read: Analysis | null = null;

  constructor(
    app: App,
    private readonly current: readonly ViewRules[],
    private readonly onImport: (views: readonly ViewRules[], conflict: Conflict) => void,
  ) {
    super(app);
  }

  override onOpen(): void {
    this.setTitle(strings.library.importTitle);

    const box = this.contentEl.createEl('textarea', {
      cls: 'tr-transfer-text',
      attr: { placeholder: strings.library.paste },
    });
    box.spellcheck = false;

    const status = this.contentEl.createDiv({ cls: 'tr-transfer-status' });

    /* Hidden, because a bare file input is not a control anyone recognises. */
    const picker = this.contentEl.createEl('input', { type: 'file', cls: 'tr-hidden' });
    picker.accept = '.json,application/json';

    const describe = (): void => {
      this.read = box.value.trim().length === 0 ? null : orNull(analyse(box.value, this.current));
      status.setText(this.summary(box.value));
    };

    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (file === undefined) return;
      void file.text().then((text) => {
        box.value = text;
        describe();
      });
    });
    box.addEventListener('input', describe);

    new Setting(this.contentEl)
      .setName(strings.library.conflict)
      .setDesc(strings.library.conflictDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            replace: strings.library.replace,
            merge: strings.library.merge,
            skip: strings.library.skip,
          })
          .setValue(this.conflict)
          .onChange((value) => {
            this.conflict = value as Conflict;
          }),
      );

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(strings.library.chooseFile).onClick(() => picker.click()),
      )
      .addButton((button) =>
        button
          .setButtonText(strings.library.import)
          .setCta()
          .onClick(() => {
            const read = this.read;
            if (read === null) return;
            this.close();
            this.onImport(read.views, this.conflict);
          }),
      );
  }

  override onClose(): void {
    this.contentEl.empty();
  }

  /** Said before anything is applied, so an import is never a surprise. */
  private summary(text: string): string {
    if (text.trim().length === 0) return '';

    const read = analyse(text, this.current);
    if (read === 'unreadable') return strings.library.notRules;
    if (read === 'newer') return strings.library.newer;
    if (read === 'empty') return strings.library.noneReadable;

    const parts = [strings.library.found.replace('{count}', String(read.views.length))];
    if (read.known > 0)
      parts.push(strings.library.alreadyHere.replace('{count}', String(read.known)));
    if (read.unreadable > 0)
      parts.push(strings.library.dropped.replace('{count}', String(read.unreadable)));
    return parts.join(' · ');
  }
}

function orNull(read: ReturnType<typeof analyse>): Analysis | null {
  return typeof read === 'string' ? null : read;
}

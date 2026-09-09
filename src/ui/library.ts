/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { SettingDefinitionGroup } from 'obsidian';
import { strings } from '../i18n';
import { notify } from '../logging/sinks';
import type { SettingsHost } from '../types/host';
import type { ViewRules } from '../types/rule';
import { type Applied, apply, type Conflict, write } from '../utils/packageTransfer';
import { ExportRulesModal, ImportRulesModal } from './transferModals';

/** Rules leave and arrive as one file, the way Style Settings moves a theme's. */
export function libraryGroup(host: SettingsHost): SettingDefinitionGroup {
  return {
    type: 'group',
    heading: strings.library.heading,
    items: [
      {
        name: strings.library.export,
        desc: strings.library.exportDesc,
        action: () => {
          new ExportRulesModal(host.app, write(host.editor.views(), host.version)).open();
        },
      },
      {
        name: strings.library.import,
        desc: strings.library.importDesc,
        action: () => {
          new ImportRulesModal(host.app, host.editor.views(), (views, conflict) => {
            void receive(host, views, conflict);
          }).open();
        },
      },
    ],
  };
}

async function receive(
  host: SettingsHost,
  incoming: readonly ViewRules[],
  conflict: Conflict,
): Promise<void> {
  let applied: Applied | undefined;
  await host.change((current) => {
    // The serial save queue may contain edits made while the import dialog was open.
    applied = apply(current, incoming, conflict);
    return applied.views;
  });
  if (applied !== undefined) notify(report(applied), 'success');
}

/* Said afterwards in the same terms the dialog used beforehand. */
function report(applied: Applied): string {
  const parts = [strings.library.added.replace('{count}', String(applied.added))];

  if (applied.replaced > 0)
    parts.push(strings.library.replaced.replace('{count}', String(applied.replaced)));
  if (applied.merged > 0)
    parts.push(strings.library.mergedCount.replace('{count}', String(applied.merged)));
  if (applied.skipped > 0)
    parts.push(strings.library.skippedCount.replace('{count}', String(applied.skipped)));

  return parts.join(' · ');
}

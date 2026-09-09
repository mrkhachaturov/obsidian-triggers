/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Plugin } from 'obsidian';
import { strings } from '../i18n';
import type { IRuleEditor } from '../interfaces/IRuleProvider';
import { log, reportError } from '../logging/log';
import { DEFAULT_DATA, type PluginData, SCHEMA_VERSION, type ViewRules } from '../types/rule';
import { readViews } from '../utils/readData';

/**
 * `data.json`, treated as the untrusted input it is: users edit it by hand, writes
 * get truncated, sync merges half of one. See the reading rules in AGENTS.md.
 */
export class RuleStore implements IRuleEditor {
  private data: PluginData = DEFAULT_DATA;
  /* Set when the file held something we could not read. Saving would persist our
   * reading of it and destroy what a person could still recover by hand. */
  private frozen = false;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<void> {
    const loaded: unknown = await this.plugin.loadData();
    if (
      loaded !== null &&
      loaded !== undefined &&
      (typeof loaded !== 'object' || Array.isArray(loaded))
    ) {
      this.frozen = true;
      log.send('error', strings.store.unreadable);
      return;
    }
    const source =
      typeof loaded === 'object' && loaded !== null ? (loaded as Record<string, unknown>) : {};

    const version = source['schemaVersion'];
    if (version !== undefined && version !== SCHEMA_VERSION) {
      this.frozen = true;
      log.send('error', strings.store.unreadable);
      return;
    }
    const raw = source['views'];
    if (raw !== undefined && !Array.isArray(raw)) {
      this.frozen = true;
      log.send('error', strings.store.unreadable);
      return;
    }

    const { views, skipped } = readViews(raw ?? []);
    this.data = { schemaVersion: SCHEMA_VERSION, views };

    if (skipped > 0) {
      this.frozen = true;
      log.send('error', strings.store.unreadable);
      log.send(
        'warning',
        skipped === 1
          ? strings.store.skippedOne
          : strings.store.skippedMany.replace('{count}', String(skipped)),
      );
    }
  }

  views(): readonly ViewRules[] {
    return this.data.views;
  }

  /**
   * Apply a change and persist it.
   *
   * Writes are serialised: two rules firing at once must not interleave a save.
   */
  update(change: (views: readonly ViewRules[]) => readonly ViewRules[]): Promise<void> {
    const next = this.writing.then(async () => {
      this.data = { schemaVersion: SCHEMA_VERSION, views: change(this.data.views) };

      if (this.frozen) return;
      try {
        await this.plugin.saveData(this.data);
      } catch (err) {
        reportError(err, strings.store.saveFailed);
      }
    });

    this.writing = next.catch(() => undefined);
    return next;
  }
}

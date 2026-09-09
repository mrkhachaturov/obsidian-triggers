/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { Plugin } from 'obsidian';
import { strings } from './i18n';
import { log } from './logging/log';
import { ConsoleSink, NoticeSink } from './logging/sinks';
import { ContextWatcher } from './services/ContextWatcher';
import { CommandHandler } from './services/handlers/CommandHandler';
import { QuickAddHandler } from './services/handlers/QuickAddHandler';
import { RuleRunner } from './services/RuleRunner';
import { RuleStore } from './services/RuleStore';
import { TraceService } from './services/TraceService';
import type { Context } from './types/context';
import type { LogEntry } from './types/trace';
import { TriggersSettingTab } from './ui/settings';

/* Wiring only. Every service is constructed here and handed what it needs; none of
 * them reaches back into the plugin for a sibling. */
export default class TriggersPlugin extends Plugin {
  private readonly store = new RuleStore(this);
  private readonly trace = new TraceService(this.app);
  private watcher: ContextWatcher | null = null;

  readonly api = {
    version: 1,
    context: (): Context | null => this.watcher?.current() ?? null,
    onContextChange: (listener: (context: Context | null) => void): (() => void) =>
      this.watcher?.onChange(listener) ?? (() => undefined),
    /* The trace, so "why did it not run" is answerable from the console too. */
    log: (): readonly LogEntry[] => this.trace.list(),
  };

  override async onload(): Promise<void> {
    this.register(log.register(new ConsoleSink()));
    this.register(log.register(new NoticeSink()));
    this.register(log.register(this.trace));

    await this.store.load();

    const quickAdd = new QuickAddHandler(this.app);
    const runner = new RuleRunner(this.app, () => this.store, this.trace, [
      new CommandHandler(this.app),
      quickAdd,
    ]);

    const watcher = new ContextWatcher(this);
    this.watcher = watcher;
    this.register(runner.listen(watcher));
    watcher.start();

    /* The same walk a navigation takes, on demand: a rule can be tried without
     * going somewhere else and coming back. */
    this.addCommand({
      id: 'run-here',
      name: strings.commands.runHere,
      checkCallback: (checking) => {
        const context = watcher.current();
        if (checking) return context !== null;
        if (context !== null) runner.runHere(context);
        return true;
      },
    });

    this.addSettingTab(
      new TriggersSettingTab(this, {
        editor: this.store,
        steps: runner,
        choices: quickAdd,
        trace: this.trace,
        reader: watcher,
        version: this.manifest.version,
      }),
    );
  }
}

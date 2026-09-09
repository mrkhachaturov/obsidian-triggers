/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Plugin, WorkspaceLeaf } from 'obsidian';
import type { IContextReader } from '../interfaces/IContextReader';
import { type Context, sameContext } from '../types/context';

/* Only what readContext reads, so a leaf-shaped literal is a legal fixture and
   tests do not cast their way past the type checker. */
type Readable = Pick<WorkspaceLeaf, 'getViewState'>;

/**
 * Read the context out of a leaf.
 *
 * `getViewState()` is the whole source of truth: a `.base` carries its path in
 * `state.file` exactly as a note does, and the Base's current view in
 * `state.viewName`.
 */
export function readContext(leaf: Readable | null): Context | null {
  if (leaf === null) return null;

  const view = leaf.getViewState();
  const state = view.state ?? {};

  return {
    viewType: view.type,
    path: typeof state.file === 'string' ? state.file : null,
    viewName: typeof state.viewName === 'string' ? state.viewName : null,
  };
}

/**
 * Observer over the workspace: turns Obsidian's events into a context, and
 * publishes it when it actually differs.
 *
 * The only module allowed to subscribe to workspace events for this purpose.
 * Everything downstream takes an IContextReader.
 */
export class ContextWatcher implements IContextReader {
  private context: Context | null = null;
  private active = false;
  private readonly listeners = new Set<(context: Context | null) => void>();

  constructor(private readonly plugin: Plugin) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.plugin.register(() => {
      this.active = false;
      this.context = null;
      this.listeners.clear();
    });
    const workspace = this.plugin.app.workspace;
    const wake = (): void => {
      if (this.active) this.publish(readContext(workspace.getMostRecentLeaf()));
    };

    this.plugin.registerEvent(workspace.on('active-leaf-change', wake));
    /* A tab that opens, closes or moves does not always change the active leaf,
       and the context can still be a different one afterwards. */
    this.plugin.registerEvent(workspace.on('layout-change', wake));

    workspace.onLayoutReady(wake);
  }

  current(): Context | null {
    return this.context;
  }

  onChange(listener: (context: Context | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /* Obsidian fires several events for one move - opening a Base raised
     active-leaf-change, file-open and layout-change, measured. Publishing on
     every one would run a rule three times, so an unchanged context is dropped. */
  private publish(context: Context | null): void {
    if (!this.active || sameContext(context, this.context)) return;
    this.context = context;
    for (const listener of this.listeners) listener(context);
  }
}

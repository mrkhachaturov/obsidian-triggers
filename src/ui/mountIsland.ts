/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { VNode } from 'preact';
import { render } from 'preact';
import { strings } from '../i18n';
import { reportError } from '../logging/log';

/** What a host keeps after mounting: a way to take it down, and whether it came up. */
export interface Mounted {
  /** Idempotent: a row can be torn down twice - once by the framework, once by us. */
  destroy(): void;
  /** False when the mount threw and the message is showing in its place. */
  readonly ok: boolean;
}

/**
 * Mount a component into a settings row, and never throw.
 *
 * The declarative tab builds its screen by calling every `render` closure in
 * turn, so a throw here does not cost the component - it costs every setting
 * after it. QuickAdd shipped that bug three times (#1451, #1507, #1566) before
 * putting the guard in the one place a component is mounted from, which is what
 * this is.
 *
 * The message that replaces it is plain elements, not another component: a
 * fallback that can fail the same way is not a fallback.
 */
export function mountIsland(target: HTMLElement, node: VNode, what: string): Mounted {
  let torn = false;

  try {
    render(node, target);
  } catch (err) {
    reportError(err, what);
    target.empty();
    target.createDiv({ cls: 'tr-island-failed', text: `${what}: ${strings.island.failed}` });

    return {
      ok: false,
      destroy: () => {
        if (torn) return;
        torn = true;
        target.empty();
      },
    };
  }

  return {
    ok: true,
    destroy: () => {
      if (torn) return;
      torn = true;
      render(null, target);
    },
  };
}

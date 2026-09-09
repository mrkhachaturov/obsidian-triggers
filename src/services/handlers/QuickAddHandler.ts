/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { strings } from '../../i18n';
import type { IStepHandler, StepOutcome } from '../../interfaces/IStepHandler';
import { reportError } from '../../logging/log';
import type { Step } from '../../types/rule';

export interface QuickAddChoice {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

interface QuickAddInstance {
  api?: { executeChoice?: (name: string, variables?: Record<string, unknown>) => Promise<unknown> };
  settings?: { choices?: unknown };
}

/**
 * Hands a step to QuickAdd, with the context as variables.
 *
 * `executeChoice` takes a name, not an id, and reports rather than throws when it
 * misses - so the id is what we store and the name is resolved here, at fire time,
 * from the instance. Absent QuickAdd is not an error: the step reports and the rest
 * of the rule carries on.
 */
export class QuickAddHandler implements IStepHandler {
  readonly kind = 'quickadd' as const;

  constructor(private readonly app: App) {}

  /** Reads instance state, not a declared API: guarded, and empty when it is gone. */
  choices(): readonly QuickAddChoice[] {
    const raw = this.instance()?.settings?.choices;
    if (!Array.isArray(raw)) return [];

    return raw.flatMap((entry): QuickAddChoice[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { id, name, type } = entry as Record<string, unknown>;
      if (typeof id !== 'string' || typeof name !== 'string') return [];
      return [{ id, name, type: typeof type === 'string' ? type : '' }];
    });
  }

  available(step: Step): boolean {
    if (step.kind !== 'quickadd') return true;
    if (typeof this.instance()?.api?.executeChoice !== 'function') return false;
    return this.resolveName(step.choiceId, step.choiceName) !== null;
  }

  describe(step: Step): string {
    return step.kind === 'quickadd' ? step.choiceName : '';
  }

  run(step: Step, variables: Record<string, string>): StepOutcome {
    if (step.kind !== 'quickadd') return { ok: false, detail: 'not a QuickAdd step' };

    const api = this.instance()?.api;
    if (typeof api?.executeChoice !== 'function')
      return { ok: false, detail: strings.runner.quickAddMissing };

    const name = this.resolveName(step.choiceId, step.choiceName);
    if (name === null)
      return { ok: false, detail: `${strings.runner.noChoice} "${step.choiceName}"` };

    /* Not awaited: a choice may open a prompt and sit there. Dispatch is the
     * plugin's job; finishing belongs to whoever owns the choice. */
    void api.executeChoice(name, variables).catch((err: unknown) => {
      reportError(err, `QuickAdd choice "${name}"`);
    });
    return { ok: true, detail: name };
  }

  /** The id survives a rename; the stored name is the fallback when it does not. */
  private resolveName(id: string, name: string): string | null {
    const all = this.choices();
    if (all.length === 0) return null;

    const byId = all.find((choice) => choice.id === id);
    if (byId !== undefined) return byId.name;
    return all.some((choice) => choice.name === name) ? name : null;
  }

  private instance(): QuickAddInstance | null {
    const plugin = this.app.plugins.plugins['quickadd'];
    return typeof plugin === 'object' && plugin !== null ? plugin : null;
  }
}

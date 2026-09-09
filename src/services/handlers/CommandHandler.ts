/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { strings } from '../../i18n';
import type { IStepHandler, StepOutcome } from '../../interfaces/IStepHandler';
import type { Step } from '../../types/rule';

/** Runs an Obsidian command. Almost every plugin publishes commands, so this one
 *  handler reaches most of the vault without knowing anything about it. */
export class CommandHandler implements IStepHandler {
  readonly kind = 'command' as const;

  constructor(private readonly app: App) {}

  available(step: Step): boolean {
    return step.kind !== 'command' || this.app.commands.findCommand(step.commandId) !== undefined;
  }

  describe(step: Step): string {
    if (step.kind !== 'command') return '';
    return this.app.commands.findCommand(step.commandId)?.name ?? step.commandId;
  }

  run(step: Step): StepOutcome {
    if (step.kind !== 'command') return { ok: false, detail: 'not a command step' };

    const command = this.app.commands.findCommand(step.commandId);
    if (command === undefined)
      return { ok: false, detail: `${strings.runner.noCommand} "${step.commandId}"` };

    const ran = this.app.commands.executeCommandById(step.commandId);
    return ran
      ? { ok: true, detail: command.name }
      : { ok: false, detail: `"${command.name}" ${strings.runner.declined}` };
  }
}

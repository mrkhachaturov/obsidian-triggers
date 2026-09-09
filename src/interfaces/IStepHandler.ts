/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Step, StepKind } from '../types/rule';

/** What a step run reports back, in the words the trace prints. */
export interface StepOutcome {
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * A kind of action. A new one registers here; the runner never grows a branch.
 */
export interface IStepHandler {
  readonly kind: StepKind;
  /** Whether the target still exists, for the warning on the rule's settings entry. */
  available(step: Step): boolean;
  describe(step: Step): string;
  run(step: Step, variables: Record<string, string>): StepOutcome;
}

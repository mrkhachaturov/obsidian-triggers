/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Context } from '../types/context';
import type { Rule, StepKind } from '../types/rule';
import type { IStepHandler } from './IStepHandler';

/** What the settings screen needs of the runner: what an action is, and whether it still works. */
export interface IStepRegistry {
  handler(kind: StepKind): IStepHandler | undefined;
  /** Whether every action of this rule still points at something that exists. */
  intact(rule: Rule): boolean;
  /** Run one rule here because the user asked. False when its conditions did not hold. */
  runOne(rule: Rule, context: Context): boolean;
}

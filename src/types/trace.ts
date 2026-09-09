/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { Level } from '../logging/ILogger';
import type { Context } from './context';
import type { Field } from './rule';

/**
 * Why a rule did not run: the first row that refused it, or `any` when the list
 * is read as "any of these" and so no single row is the answer.
 */
export type MissField = 'disabled' | 'trigger' | 'any' | Field;

export interface RuleOutcome {
  readonly rule: string;
  readonly matched: boolean;
  /** Present only when `matched` is false. */
  readonly missed?: MissField;
  /** One line per step: what it did, or why it did not. */
  readonly steps: readonly string[];
}

export interface TraceEntry {
  readonly at: number;
  readonly context: Context | null;
  readonly rules: readonly RuleOutcome[];
  readonly elapsedMs: number;
}

export interface ReportEntry {
  readonly at: number;
  readonly level: Level;
  readonly message: string;
}

export type LogEntry =
  | ({ readonly kind: 'trace' } & TraceEntry)
  | ({ readonly kind: 'report' } & ReportEntry);

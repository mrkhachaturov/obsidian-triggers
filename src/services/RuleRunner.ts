/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { strings } from '../i18n';
import type { IContextReader } from '../interfaces/IContextReader';
import type { IRuleProvider } from '../interfaces/IRuleProvider';
import type { IStepHandler } from '../interfaces/IStepHandler';
import { reportError } from '../logging/log';
import type { Context } from '../types/context';
import { FRONTMATTER_PREFIX, VARIABLE_NAME } from '../types/registry';
import type { Rule, Step, StepKind } from '../types/rule';
import type { RuleOutcome } from '../types/trace';
import { matchesRule } from '../utils/match';
import { type Facts, lazyFacts, typedValues } from '../utils/noteFacts';
import type { TraceService } from './TraceService';

/**
 * The whole behaviour of the plugin: a context arrived, so run what matches.
 *
 * Every matching rule runs, in the order the user arranged them. A rule that does
 * not match is recorded with the field that refused it, because "why did it not
 * run" is the only question users ask.
 */
export class RuleRunner {
  private readonly handlers = new Map<StepKind, IStepHandler>();

  constructor(
    private readonly app: App,
    private readonly getRules: () => IRuleProvider,
    private readonly trace: TraceService,
    handlers: readonly IStepHandler[],
  ) {
    for (const handler of handlers) this.handlers.set(handler.kind, handler);
  }

  listen(reader: IContextReader): () => void {
    return reader.onChange((context) => this.fire(context));
  }

  handler(kind: StepKind): IStepHandler | undefined {
    return this.handlers.get(kind);
  }

  /** Whether every step of this rule still points at something that exists. */
  intact(rule: Rule): boolean {
    return rule.steps.every((step) => this.handlers.get(step.kind)?.available(step) ?? false);
  }

  /**
   * Run one rule here, now, because the user asked.
   *
   * The condition is still evaluated - the question being asked is "does this
   * rule fire where I am", and a button that runs the actions regardless answers
   * a different one. Order and `stop` belong to the walk, not to this.
   */
  runOne(rule: Rule, context: Context): boolean {
    const facts = lazyFacts(this.app, context.path);
    if (!matchesRule(rule, context, facts, typedValues(this.app)).ok) return false;

    this.runSteps(rule, context, facts, false);
    return true;
  }

  /** The whole walk, on demand: the same path a navigation takes. */
  runHere(context: Context): void {
    this.fire(context);
  }

  private fire(context: Context | null): void {
    if (context === null) return;

    /* Describing the run costs an object per rule, so it is built only while the
     * user is recording. Matching and dispatch are the same either way. */
    const recording = this.trace.recording;
    const started = recording ? performance.now() : 0;
    const outcomes: RuleOutcome[] = [];

    /* One reader for the whole event: the cache is consulted at most once, and
     * only if some rule asks about the note. */
    const facts = lazyFacts(this.app, context.path);
    const typed = typedValues(this.app);

    /* A view whose type is not this one is skipped whole: opening a note never
     * looks at a single rule written for Bases. */
    walk: for (const view of this.getRules().views()) {
      if (view.viewType !== context.viewType) continue;

      for (const rule of view.rules) {
        const match = matchesRule(rule, context, facts, typed);
        if (!match.ok) {
          if (recording)
            outcomes.push({ rule: rule.name, matched: false, missed: match.missed, steps: [] });
          continue;
        }

        const steps = this.runSteps(rule, context, facts, recording);
        if (recording) outcomes.push({ rule: rule.name, matched: true, steps });

        /* The whole walk, not just this view: precedence is one order. */
        if (rule.stop) break walk;
      }
    }

    if (!recording) return;
    this.trace.record({
      at: Date.now(),
      context,
      rules: outcomes,
      elapsedMs: Math.round(performance.now() - started),
    });
  }

  private runSteps(rule: Rule, context: Context, facts: Facts, recording: boolean): string[] {
    const variables = variablesFor(rule, context, facts);
    const lines: string[] = [];

    for (const step of rule.steps) {
      const handler = this.handlers.get(step.kind);
      if (handler === undefined) {
        if (recording) lines.push(`${step.kind}: ${strings.runner.noHandler}`);
        continue;
      }

      /* One failing step costs that step. The rest of the rule still runs. */
      try {
        const outcome = handler.run(step, variables);
        if (recording)
          lines.push(
            `${outcome.ok ? strings.runner.ran : strings.runner.skippedAction} ${outcome.detail}`,
          );
      } catch (err) {
        reportError(err, `Rule "${rule.name}"`);
        if (recording) lines.push(`${strings.runner.failed} ${describe(step)}`);
      }
    }

    return lines;
  }
}

function describe(step: Step): string {
  return step.kind === 'command' ? step.commandId : step.choiceName;
}

/* The public variable set, documented in docs/rule-format.md. Always present and
 * always a string: a missing key and an empty value are the same thing to
 * {{VALUE:...}}, so they are made the same thing here. */
function variablesFor(rule: Rule, context: Context, facts: Facts): Record<string, string> {
  const variables: Record<string, string> = {
    [VARIABLE_NAME.viewType]: context.viewType,
    [VARIABLE_NAME.path]: context.path ?? '',
    [VARIABLE_NAME.viewName]: context.viewName ?? '',
    [VARIABLE_NAME.rule]: rule.name,
  };

  /* Only a QuickAdd step can read these, so the cache is left alone for a rule
   * that just runs a command. */
  if (!rule.steps.some((step) => step.kind === 'quickadd')) return variables;

  const note = facts();
  if (note === null) return variables;

  for (const [key, value] of Object.entries(note.frontmatter)) {
    const flat = flatten(value);
    if (flat !== null) variables[`${FRONTMATTER_PREFIX}.${key}`] = flat;
  }
  return variables;
}

/* A variable is a string. A property that is a nested object has no honest flat
 * form, and "[object Object]" in someone's template is worse than the variable
 * not being there, so it is left out. */
function flatten(value: unknown): string | null {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    const parts = value.map(flatten).filter((part): part is string => part !== null);
    return parts.join(', ');
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

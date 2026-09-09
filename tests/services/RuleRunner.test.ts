/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { describe, expect, it } from 'vitest';
import type { IContextReader } from '../../src/interfaces/IContextReader';
import type { IStepHandler, StepOutcome } from '../../src/interfaces/IStepHandler';
import { RuleRunner } from '../../src/services/RuleRunner';
import { TraceService } from '../../src/services/TraceService';
import type { Context } from '../../src/types/context';
import type { Rule, Step, ViewRules } from '../../src/types/rule';
import {
  commandStep,
  localApp,
  makeCondition,
  makeContext,
  makeRule,
  makeView,
  path,
  quickAddStep,
} from '../factories';

/** A handler that records what it was asked to run, in order. */
class RecordingHandler implements IStepHandler {
  readonly kind = 'command' as const;
  readonly ran: string[] = [];

  constructor(
    private readonly outcome: (step: Step) => StepOutcome = () => ({ ok: true, detail: 'ok' }),
  ) {}

  available(): boolean {
    return true;
  }

  describe(step: Step): string {
    return step.kind === 'command' ? step.commandId : '';
  }

  run(step: Step, variables: Record<string, string>): StepOutcome {
    if (step.kind === 'command')
      this.ran.push(`${step.commandId}:${variables['trigger.rule'] ?? ''}`);
    return this.outcome(step);
  }
}

/** A handler that keeps the variables it was handed, so the public set can be pinned. */
class VariableHandler implements IStepHandler {
  readonly kind = 'quickadd' as const;
  variables: Record<string, string> = {};

  available(): boolean {
    return true;
  }

  describe(): string {
    return '';
  }

  run(_step: Step, variables: Record<string, string>): StepOutcome {
    this.variables = variables;
    return { ok: true, detail: '' };
  }
}

/** A reader the test drives by hand, standing in for the workspace. */
class FakeReader implements IContextReader {
  private listener: ((context: Context | null) => void) | null = null;

  current(): Context | null {
    return null;
  }

  onChange(listener: (context: Context | null) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  emit(context: Context | null): void {
    this.listener?.(context);
  }
}

/** The runner only reaches the app to read a note's metadata, which no test needs. */
function fakeApp(): App {
  return {
    vault: { getFileByPath: () => null },
    metadataCache: { getFileCache: () => null },
  } as unknown as App;
}

function runnerFor(rules: Rule[], handler: IStepHandler, recording = true) {
  return runnerForViews([makeView('markdown', rules)], handler, recording);
}

function runnerForViews(views: ViewRules[], handler: IStepHandler, recording = true) {
  const trace = new TraceService(localApp());
  trace.setRecording(recording);
  const runner = new RuleRunner(fakeApp(), () => ({ views: () => views }), trace, [handler]);
  const reader = new FakeReader();
  const stop = runner.listen(reader);
  return { runner, trace, reader, stop };
}

describe('RuleRunner', () => {
  it('runs every matching rule, in the order the user arranged them', () => {
    const handler = new RecordingHandler();
    const rules = [
      makeRule({ id: '1', name: 'First', steps: [commandStep('one')] }),
      makeRule({ id: '2', name: 'Second', steps: [commandStep('two')] }),
    ];
    const { reader } = runnerFor(rules, handler);

    reader.emit(makeContext());

    expect(handler.ran).toEqual(['one:First', 'two:Second']);
  });

  it('runs nothing when no rule matches, and says which block refused it', () => {
    const handler = new RecordingHandler();
    const when = makeCondition([path('inFolder', 'Journal')]);
    const rules = [makeRule({ name: 'Kanban', when, steps: [commandStep('x')] })];
    const { trace, reader } = runnerFor(rules, handler);

    reader.emit(makeContext({ path: 'Atlas/Note.md' }));

    expect(handler.ran).toEqual([]);
    const entry = trace.list()[0];
    if (entry === undefined || entry.kind !== 'trace') throw new Error('expected a trace entry');
    expect(entry.rules[0]).toMatchObject({ rule: 'Kanban', matched: false, missed: 'path' });
  });

  /* The view type is the chain, not a condition: a note opening never looks at a
   * single rule written for Bases. */
  it('never looks at a view written for another type', () => {
    const handler = new RecordingHandler();
    const views = [makeView('bases', [makeRule({ name: 'Kanban', steps: [commandStep('x')] })])];
    const { trace, reader } = runnerForViews(views, handler);

    reader.emit(makeContext({ viewType: 'markdown' }));

    expect(handler.ran).toEqual([]);
    const entry = trace.list()[0];
    if (entry === undefined || entry.kind !== 'trace') throw new Error('expected a trace entry');
    expect(entry.rules).toEqual([]);
  });

  it('ends the walk after a rule that stops, in every view', () => {
    const handler = new RecordingHandler();
    const views = [
      makeView('markdown', [
        makeRule({ id: '1', name: 'First', steps: [commandStep('one')], stop: true }),
        makeRule({ id: '2', name: 'Second', steps: [commandStep('two')] }),
      ]),
      makeView(
        'markdown',
        [makeRule({ id: '3', name: 'Third', steps: [commandStep('three')] })],
        'second-markdown',
      ),
    ];
    const { reader } = runnerForViews(views, handler);

    reader.emit(makeContext());

    expect(handler.ran).toEqual(['one:First']);
  });

  it('records the context it read, so the log answers "where was I"', () => {
    const { trace, reader } = runnerFor([], new RecordingHandler());

    reader.emit(makeContext({ viewType: 'bases', path: 'A.base', viewName: 'Kanban Board' }));

    const entry = trace.list()[0];
    if (entry === undefined || entry.kind !== 'trace') throw new Error('expected a trace entry');
    expect(entry.context).toEqual({ viewType: 'bases', path: 'A.base', viewName: 'Kanban Board' });
  });

  it('keeps going when a step throws, and reports the failure', () => {
    const handler = new RecordingHandler((step) => {
      if (step.kind === 'command' && step.commandId === 'boom') throw new Error('exploded');
      return { ok: true, detail: 'ok' };
    });
    const rules = [
      makeRule({ name: 'Two steps', steps: [commandStep('boom'), commandStep('after')] }),
    ];
    const { trace, reader } = runnerFor(rules, handler);

    reader.emit(makeContext());

    expect(handler.ran).toEqual(['boom:Two steps', 'after:Two steps']);
    const entry = trace.list()[0];
    if (entry === undefined || entry.kind !== 'trace') throw new Error('expected a trace entry');
    expect(entry.rules[0]?.steps[0]).toContain('failed');
  });

  it('says so rather than silently doing nothing when no handler owns a step kind', () => {
    const rules = [
      makeRule({ name: 'Orphan', steps: [{ kind: 'quickadd', choiceId: 'x', choiceName: 'X' }] }),
    ];
    const { trace, reader } = runnerFor(rules, new RecordingHandler());

    reader.emit(makeContext());

    const entry = trace.list()[0];
    if (entry === undefined || entry.kind !== 'trace') throw new Error('expected a trace entry');
    expect(entry.rules[0]?.steps[0]).toBe('quickadd: nothing can run it');
  });

  it('records nothing until the user asks it to', () => {
    const handler = new RecordingHandler();
    const rules = [makeRule({ name: 'Quiet', steps: [commandStep('one')] })];
    const { trace, reader } = runnerFor(rules, handler, false);

    reader.emit(makeContext());

    expect(handler.ran).toEqual(['one:Quiet']);
    expect(trace.list()).toEqual([]);
  });

  it('stops listening when the subscription is released', () => {
    const handler = new RecordingHandler();
    const { reader, stop } = runnerFor([makeRule({ steps: [commandStep('one')] })], handler);

    stop();
    reader.emit(makeContext());

    expect(handler.ran).toEqual([]);
  });
});

/* The variable set is a public interface: someone's template breaks when it
 * changes. See docs/rule-format.md. */
describe('RuleRunner variables', () => {
  function runWith(handler: IStepHandler, cache: unknown, rules: Rule[]) {
    const trace = new TraceService(localApp());
    const app = {
      vault: { getFileByPath: () => ({ path: 'Atlas/Note.md' }) },
      metadataCache: { getFileCache: () => cache },
    } as unknown as App;

    const runner = new RuleRunner(
      app,
      () => ({ views: () => [makeView('markdown', rules)] }),
      trace,
      [handler],
    );
    const reader = new FakeReader();
    runner.listen(reader);
    reader.emit(makeContext({ viewType: 'markdown', path: 'Atlas/Note.md' }));
  }

  it('always passes where the user is and which rule fired', () => {
    const handler = new VariableHandler();
    runWith(handler, {}, [makeRule({ name: 'Notes', steps: [quickAddStep('a', 'A')] })]);

    expect(handler.variables).toMatchObject({
      'trigger.viewType': 'markdown',
      'trigger.path': 'Atlas/Note.md',
      'trigger.viewName': '',
      'trigger.rule': 'Notes',
    });
  });

  it("passes the note's properties, lists joined so contains works", () => {
    const handler = new VariableHandler();
    const cache = {
      frontmatter: { type: 'task', status: ['active', 'urgent'] },
      tags: [{ tag: '#now' }],
    };
    runWith(handler, cache, [makeRule({ steps: [quickAddStep('a', 'A')] })]);

    expect(handler.variables['trigger.fm.type']).toBe('task');
    expect(handler.variables['trigger.fm.status']).toBe('active, urgent');
    /* A tag in the body of the note is not a property, so it is not passed. */
    expect(handler.variables['trigger.tags']).toBeUndefined();
  });

  it('leaves out a property that is a nested object', () => {
    const handler = new VariableHandler();
    const cache = { frontmatter: { type: 'task', nested: { a: 1 } } };
    runWith(handler, cache, [makeRule({ steps: [quickAddStep('a', 'A')] })]);

    expect(handler.variables['trigger.fm.type']).toBe('task');
    expect(handler.variables['trigger.fm.nested']).toBeUndefined();
  });

  /* A rule that only runs a command has no reader for them, so the cache is
   * never consulted on its behalf. */
  it('leaves the note alone for a rule with no QuickAdd action', () => {
    const handler = new RecordingHandler();
    let reads = 0;
    const trace = new TraceService(localApp());
    const app = {
      vault: {
        getFileByPath: () => {
          reads += 1;
          return { path: 'Atlas/Note.md' };
        },
      },
      metadataCache: { getFileCache: () => ({}) },
    } as unknown as App;

    const runner = new RuleRunner(
      app,
      () => ({ views: () => [makeView('markdown', [makeRule({ steps: [commandStep('one')] })])] }),
      trace,
      [handler],
    );
    const reader = new FakeReader();
    runner.listen(reader);
    reader.emit(makeContext());

    expect(handler.ran).toHaveLength(1);
    expect(reads).toBe(0);
  });
});

describe('RuleRunner.intact', () => {
  it('is false when a step points at something that is gone', () => {
    const missing: IStepHandler = {
      kind: 'command',
      available: () => false,
      describe: () => '',
      run: () => ({ ok: false, detail: '' }),
    };
    const { runner } = runnerFor([], missing);

    expect(runner.intact(makeRule({ steps: [commandStep('gone')] }))).toBe(false);
  });

  it('is false when nothing handles the step kind at all', () => {
    const { runner } = runnerFor([], new RecordingHandler());
    expect(
      runner.intact(makeRule({ steps: [{ kind: 'quickadd', choiceId: 'x', choiceName: 'X' }] })),
    ).toBe(false);
  });
});

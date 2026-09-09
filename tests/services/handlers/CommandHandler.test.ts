/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { CommandHandler } from '../../../src/services/handlers/CommandHandler';

const step = { kind: 'command' as const, commandId: 'plugin:run' };

function fixture(present: boolean, execute = vi.fn(() => true)) {
  const findCommand = vi.fn(() => (present ? { id: step.commandId, name: 'Run task' } : undefined));
  return {
    execute,
    handler: new CommandHandler({
      commands: { findCommand, executeCommandById: execute },
    } as unknown as App),
  };
}

describe('CommandHandler', () => {
  it('reports a removed command without dispatching it and preserves its ID for diagnosis', () => {
    const { handler, execute } = fixture(false);
    expect(handler.available(step)).toBe(false);
    expect(handler.describe(step)).toBe(step.commandId);
    expect(handler.run(step)).toMatchObject({
      ok: false,
      detail: expect.stringContaining(step.commandId) as unknown,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('distinguishes successful dispatch from a command declining the current context', () => {
    const { handler, execute } = fixture(true);
    expect(handler.available(step)).toBe(true);
    expect(handler.run(step)).toEqual({ ok: true, detail: 'Run task' });
    expect(execute).toHaveBeenCalledWith(step.commandId);
    execute.mockReturnValue(false);
    expect(handler.run(step)).toMatchObject({
      ok: false,
      detail: expect.stringContaining('Run task') as unknown,
    });
  });

  it('passes a command exception to the runner boundary rather than reporting success', () => {
    const failure = new Error('command failed');
    const { handler } = fixture(
      true,
      vi.fn(() => {
        throw failure;
      }),
    );
    expect(() => handler.run(step)).toThrow(failure);
  });

  it('does not dispatch a step owned by another integration', () => {
    const { handler, execute } = fixture(true);
    expect(handler.run({ kind: 'quickadd', choiceId: 'a', choiceName: 'A' }).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });
});

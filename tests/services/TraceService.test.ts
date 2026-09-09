/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TraceService } from '../../src/services/TraceService';
import { localApp } from '../factories';

const trace = { at: 10, context: null, rules: [], elapsedMs: 1 };
const report = { at: 20, level: 'warning' as const, message: 'Unavailable command' };

let app = localApp();
beforeEach(() => {
  app = localApp();
});
afterEach(() => vi.restoreAllMocks());

describe('TraceService retention and recording', () => {
  it('always retains reports but only records navigation after opting in', () => {
    const service = new TraceService(app);
    service.record(trace);
    service.receive(report);
    expect(service.list()).toEqual([{ kind: 'report', ...report }]);
    service.setRecording(true);
    service.record(trace);
    service.setRecording(false);
    service.record({ ...trace, at: 30 });
    expect(service.list()).toEqual([
      { kind: 'trace', ...trace },
      { kind: 'report', ...report },
    ]);
  });

  it('bounds the combined log at 200 newest entries and returns independent list snapshots', () => {
    const service = new TraceService(app);
    for (let at = 0; at < 205; at++) service.receive({ ...report, at });
    const snapshot = service.list();
    expect(snapshot).toHaveLength(200);
    expect(snapshot[0]?.at).toBe(204);
    expect(snapshot[199]?.at).toBe(5);
    service.clear();
    expect(service.list()).toEqual([]);
    expect(snapshot).toHaveLength(200);
    service.receive(report);
    expect(service.list()).toHaveLength(1);
  });

  it('persists recording preference across instances without persisting entries', () => {
    const first = new TraceService(app);
    first.setRecording(true);
    first.record(trace);
    const second = new TraceService(app);
    expect(second.recording).toBe(true);
    expect(second.list()).toEqual([]);
    second.setRecording(false);
    expect(new TraceService(app).recording).toBe(false);
  });

  it('keeps working when the device store is denied for reads and writes', () => {
    const denied = {
      loadLocalStorage: () => {
        throw new Error('denied');
      },
      saveLocalStorage: () => {
        throw new Error('quota');
      },
    } as unknown as ConstructorParameters<typeof TraceService>[0];
    const service = new TraceService(denied);
    expect(service.recording).toBe(false);
    expect(() => service.setRecording(true)).not.toThrow();
    service.record(trace);
    expect(service.recording).toBe(true);
    expect(service.list()).toHaveLength(1);
  });

  it('isolates broken subscribers and emits clear only when entries actually change', () => {
    const service = new TraceService(app);
    const broken = service.onChange(() => {
      throw new Error('closed window');
    });
    const listener = vi.fn(() => service.list().length);
    const off = service.onChange(listener);
    service.clear();
    expect(listener).not.toHaveBeenCalled();
    expect(() => service.receive(report)).not.toThrow();
    expect(listener).toHaveLastReturnedWith(1);
    service.clear();
    expect(listener).toHaveLastReturnedWith(0);
    service.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    broken();
    off();
  });

  it('publishes updates after state changes and stops notifying detached listeners', () => {
    const service = new TraceService(app);
    const changed = vi.fn(() => ({ recording: service.recording, length: service.list().length }));
    const unsubscribe = service.onChange(changed);
    service.record(trace);
    expect(changed).not.toHaveBeenCalled();
    service.setRecording(true);
    expect(changed).toHaveLastReturnedWith({ recording: true, length: 0 });
    service.record(trace);
    expect(changed).toHaveLastReturnedWith({ recording: true, length: 1 });
    service.receive(report);
    expect(changed).toHaveLastReturnedWith({ recording: true, length: 2 });
    service.clear();
    expect(changed).toHaveLastReturnedWith({ recording: true, length: 0 });
    unsubscribe();
    unsubscribe();
    changed.mockClear();
    service.receive(report);
    service.setRecording(false);
    expect(changed).not.toHaveBeenCalled();
  });
});

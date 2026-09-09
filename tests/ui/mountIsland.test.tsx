/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import { mountIsland } from '../../src/ui/mountIsland';

/* The declarative tab builds its screen by calling every render closure in turn,
 * so a throw here costs every setting after it, not just this one. QuickAdd
 * shipped that bug three times before putting the guard at the mount. */

function Fine(): VNode {
  return <p class="tr-fine">drawn</p>;
}

function Broken(): VNode {
  throw new Error('the editor is broken');
}

function detachedTarget(): HTMLDivElement {
  const target = document.body.createDiv();
  target.remove();
  return target;
}

describe('mounting an island', () => {
  it('draws the component, and says it came up', () => {
    const target = detachedTarget();
    const mounted = mountIsland(target, <Fine />, 'The conditions');

    expect(mounted.ok).toBe(true);
    expect(target.querySelector('.tr-fine')?.textContent).toBe('drawn');
  });

  it('never lets a failure escape into the rest of the screen', () => {
    const target = detachedTarget();

    expect(() => mountIsland(target, <Broken />, 'The conditions')).not.toThrow();
  });

  it('says what could not be shown, where it would have been', () => {
    const target = detachedTarget();
    const mounted = mountIsland(target, <Broken />, 'The conditions');

    expect(mounted.ok).toBe(false);
    expect(target.textContent).toBe(
      'The conditions: could not be shown. The rest of the settings still work.',
    );
  });

  /* A row is torn down by the framework and by us, and the second one must not
   * be an error. */
  it('takes itself down once, however many times it is asked', () => {
    const target = detachedTarget();
    const mounted = mountIsland(target, <Fine />, 'The conditions');

    mounted.destroy();
    mounted.destroy();

    expect(target.textContent).toBe('');
  });

  it('takes down the message the same way', () => {
    const target = detachedTarget();
    const mounted = mountIsland(target, <Broken />, 'The conditions');

    mounted.destroy();
    mounted.destroy();

    expect(target.textContent).toBe('');
  });
});

/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { render } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strings } from '../../src/i18n';
import { type Group, isGroup } from '../../src/types/rule';
import { WhenEditor } from '../../src/ui/WhenEditor';
import { group, path, property } from '../factories';

/* Every layout defect this screen produced - text in the wrong column, a button
 * stranded on its own line, a control that should not have been offered - was
 * invisible until the row could be rendered and read. */

let host: HTMLElement | null = null;

function draw(
  when: Group,
  viewType = 'markdown',
  owner = document,
): { changed: Group[]; el: HTMLElement } {
  const changed: Group[] = [];
  const el = owner.body.createDiv();
  host = el;

  render(
    <WhenEditor when={when} viewType={viewType} onChange={(next) => changed.push(next)} />,
    el,
  );
  return { changed, el };
}

afterEach(() => {
  if (host !== null) render(null, host);
  host?.ownerDocument.querySelectorAll('.test-menu').forEach((menu) => {
    menu.remove();
  });
  host?.remove();
  host = null;
});

function rowAt(el: HTMLElement, index: number): HTMLElement {
  const row = el.querySelectorAll('.tr-when-row')[index];
  if (!(row instanceof HTMLElement)) throw new Error(`no row at ${index}`);
  return row;
}

function joinAt(el: HTMLElement, index: number): HTMLSelectElement {
  const join = rowAt(el, index).parentElement?.previousElementSibling;
  if (!(join instanceof HTMLSelectElement) || !join.matches('.tr-join')) {
    throw new Error(`no connective before card ${index}`);
  }
  return join;
}

describe('the instructions', () => {
  it('stay collapsed below the condition rows', () => {
    const { el } = draw(group('and', path('is', 'a')));
    const help = el.querySelector('.tr-when-help');

    expect(help?.tagName).toBe('DETAILS');
    expect(help?.hasAttribute('open')).toBe(false);
    expect(help?.querySelector('summary')).not.toBeNull();
    expect(help?.querySelector('summary')?.textContent).toBe(strings.when.helpTitle);
    expect(el.firstElementChild?.lastElementChild).toBe(help);
  });

  // Help now pairs each goal with setup instructions; whole rows are not code snippets.
  it('pairs example goals with readable setup instructions', () => {
    const { el } = draw(group('and', path('is', 'a')));
    const examples = [...el.querySelectorAll('.tr-when-examples > div')];
    expect(examples).toHaveLength(4);
    for (const example of examples) {
      expect(example.querySelector('dt')?.textContent?.length).toBeGreaterThan(0);
      expect(example.querySelector('dd')?.textContent?.length).toBeGreaterThan(0);
      expect(example.querySelector('code')).toBeNull();
    }
    expect(examples[0]?.querySelector('dd')?.textContent).toContain('Projects');
    expect(examples[3]?.querySelector('dd')?.textContent).toContain('No value is needed');
  });

  it('keeps pattern syntax in a separate collapsed disclosure', () => {
    const { el } = draw(group('and', path('is', 'a')));
    const regex = el.querySelector('.tr-regex-help');
    expect(regex?.tagName).toBe('DETAILS');
    expect(regex?.hasAttribute('open')).toBe(false);
    expect(regex?.querySelector('summary')?.textContent).toBe(strings.when.regexTitle);
    expect(regex?.querySelector('code')?.textContent).toBe(strings.when.regexExample);
    expect(el.querySelector('.tr-help-connections')?.closest('details')).toBe(
      el.querySelector('.tr-when-help'),
    );
  });
});

describe('an empty rule', () => {
  /* A rule with nothing asked of it matches every context, which is worth
   * saying rather than showing an empty space. */
  it('says that it matches everything', () => {
    const { el } = draw(group('and'));

    expect(el.querySelector('.tr-when-empty')?.textContent).toContain('All Markdown files');
    expect(el.querySelector('.tr-when-empty p + p')?.textContent).toBeTruthy();
    expect(el.querySelectorAll('button')).toHaveLength(1);
    expect(el.querySelector('button')?.textContent).toBe('Add condition');
    expect(
      el.querySelector('.tr-when-toolbar, .tr-undo, .tr-expression-preview, .tr-when-help, input'),
    ).toBeNull();
    expect(el.querySelectorAll('.tr-when-row')).toHaveLength(0);
  });
});

describe('a condition row', () => {
  // The connective sits between cards; subject and comparison own their controls and errors.
  it('keeps the handle and menu outside the condition controls', () => {
    const { el } = draw(group('and', path('contains', 'Atlas')));
    const row = rowAt(el, 0);
    expect(row.firstElementChild?.className).toBe('tr-row-handle');
    expect(row.lastElementChild?.classList.contains('tr-row-menu')).toBe(true);
    expect(row.querySelector('.tr-join')).toBeNull();
    expect(row.querySelector('.tr-condition-fields > .tr-subject > .tr-field')).not.toBeNull();
    expect(row.querySelector('.tr-condition-fields > .tr-comparison > .tr-op')).not.toBeNull();
  });

  it('keeps the property name with its field and the value with its operator', () => {
    const { el } = draw(group('and', property('status', 'is', 'open')));
    const fields = control<HTMLElement>(rowAt(el, 0), '.tr-condition-fields');
    expect([...fields.children].map((child) => child.className)).toEqual([
      'tr-subject',
      'tr-comparison',
    ]);
    const subject = control<HTMLElement>(fields, '.tr-subject');
    const comparison = control<HTMLElement>(fields, '.tr-comparison');
    expect(subject.firstElementChild?.classList.contains('tr-field')).toBe(true);
    expect(subject.querySelector('.tr-input-stack > .tr-key')).not.toBeNull();
    expect(comparison.firstElementChild?.classList.contains('tr-op')).toBe(true);
    expect(comparison.querySelector('.tr-input-stack > .tr-value')).not.toBeNull();
  });

  it('hides the value for an operator that takes none', () => {
    const { el } = draw(group('and', property('due', 'missing')));

    expect(rowAt(el, 0).querySelector('.tr-value')).toBeNull();
  });

  it('says what it holds, rather than leaving the field empty', () => {
    const { el } = draw(group('and', property('status', 'is', 'open')));
    const row = rowAt(el, 0);

    expect(row.querySelector<HTMLInputElement>('.tr-key')?.value).toBe('status');
    expect(row.querySelector<HTMLInputElement>('.tr-value')?.value).toBe('open');
    expect(row.querySelector<HTMLSelectElement>('.tr-op')?.value).toBe('is');
  });

  it('offers only the fields the open view can produce', () => {
    const options = (viewType: string): string[] => {
      const { el } = draw(group('and', path('contains', 'x')), viewType);
      const select = rowAt(el, 0).querySelector('select.tr-field');
      return [...(select?.children ?? [])].map((option) => (option as HTMLOptionElement).value);
    };

    expect(options('markdown')).toEqual(['path', 'property']);
    expect(options('bases')).toEqual(['path', 'viewName', 'property']);
  });
});

describe('the drag handle', () => {
  /* Dragging with a pointer is not reachable from a keyboard, and the rules make
   * that a blocker rather than a nicety: the handle is the control for both. */
  it('is the first thing on the row, and says what it moves', () => {
    const { el } = draw(group('and', path('contains', 'a')));
    const handle = rowAt(el, 0).firstElementChild?.firstElementChild;

    /* A button rather than a div with a role: it is focusable and pressable
     * without anything being added to it. */
    expect(handle?.tagName).toBe('BUTTON');
    expect(handle?.getAttribute('aria-label')).toBe('Move this condition');
  });
});

describe('the connective', () => {
  it('appears between sibling cards with no placeholder before the first operand', () => {
    const { el } = draw(group('or', path('contains', 'a'), path('contains', 'b')));
    expect(el.querySelector('.tr-join-first')).toBeNull();
    expect(rowAt(el, 0).parentElement?.previousElementSibling?.matches('.tr-join')).not.toBe(true);
    expect(joinAt(el, 1).value).toBe('or');
    expect(joinAt(el, 1).nextElementSibling).toBe(rowAt(el, 1).parentElement);
    expect(el.querySelector('.tr-when-row .tr-join')).toBeNull();
  });

  // Joins now belong to operands; editing one must leave its siblings unchanged.
  it('changes only the join before its own operand', () => {
    const { changed, el } = draw(group('and', path('contains', 'a'), path('contains', 'b')));
    const control = joinAt(el, 1);

    control.value = 'or';
    control.dispatchEvent(new Event('change', { bubbles: true }));

    expect(changed[changed.length - 1]?.children).toEqual([
      path('contains', 'a'),
      { ...path('contains', 'b'), join: 'or' },
    ]);
  });
});

describe('a group', () => {
  /* Obsidian draws its own icons: `+` and `++` typed as characters are not a
   * vocabulary anyone shares. */
  it('draws its buttons with the icons the app uses', () => {
    const { el } = draw(group('and', group('or')));

    const row = rowAt(el, 0);
    expect(row.querySelector('.tr-grip .tr-icon')?.getAttribute('data-icon')).toBe('grip-vertical');
    expect(row.querySelector('.tr-row-menu .tr-icon')?.getAttribute('data-icon')).toBe('ellipsis');
    expect(row.querySelector('.tr-group-heading > .tr-group-label')).not.toBeNull();
  });

  it('draws its children indented under it', () => {
    const { el } = draw(
      group('and', path('contains', 'a'), group('or', property('due', 'exists'))),
    );

    expect(
      [...el.querySelectorAll('.tr-when-row')].map((row) => row.getAttribute('data-depth')),
    ).toEqual(['0', '0', '1']);
  });

  it('carries its own way to add a row inside it', () => {
    const { changed, el } = draw(group('and', group('or')));
    const add = rowAt(el, 0).parentElement?.querySelector<HTMLButtonElement>(
      '.tr-group-children > .tr-when-add button',
    );
    if (add === null || add === undefined) throw new Error('a group cannot be filled');

    add.click();

    const inner = changed[changed.length - 1]?.children[0];
    expect(inner && isGroup(inner) ? inner.children : []).toHaveLength(1);
  });
});

describe('adding and removing', () => {
  it('adds a row to the tree', () => {
    const { changed, el } = draw(group('and'));
    el.querySelector<HTMLButtonElement>('.tr-when-add button')?.click();

    expect(changed[changed.length - 1]?.children).toHaveLength(1);
  });

  /* A new row starts on the field the row above it uses: four conditions about
   * properties should not mean choosing "property" four times. */
  it('starts a new row on the field the one above it uses', () => {
    const { changed, el } = draw(group('and', property('status', 'is', 'open')));
    el.querySelector<HTMLButtonElement>('.tr-when-add button')?.click();

    expect(changed[changed.length - 1]?.children[1]).toHaveProperty('field', 'property');
  });

  it('removes the row through its menu, and nothing else', async () => {
    const { changed, el } = draw(group('and', path('contains', 'a'), path('contains', 'b')));
    await menuAction(rowAt(el, 0), strings.when.remove);
    expect(el.querySelector('.tr-undo')?.textContent).toBe(strings.when.undoDelete);

    expect(changed[changed.length - 1]?.children).toEqual([path('contains', 'b')]);
  });
});

function control<T extends HTMLElement>(el: ParentNode, selector: string): T {
  const found = el.querySelector<T>(selector);
  if (found === null) throw new Error(`missing control: ${selector}`);
  return found;
}

async function choose(el: ParentNode, selector: string, value: string): Promise<void> {
  const select = control<HTMLSelectElement>(el, selector);
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function click(el: ParentNode, selector: string): Promise<void> {
  control<HTMLElement>(el, selector).click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function menuButton(title: string): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('.test-menu [role="menuitem"]'),
  ].find((item) => item.textContent === title);
  if (button === undefined) throw new Error(`missing menu item: ${title}`);
  return button;
}

async function menuAction(row: HTMLElement, title: string): Promise<void> {
  await click(row, '.tr-row-menu');
  menuButton(title).click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('editing an expression', () => {
  it('keeps A or B and C as independent joins and previews the expression', async () => {
    const { el, changed } = draw(group('and', path('is', 'a'), path('is', 'b'), path('is', 'c')));
    const join = joinAt(el, 1);
    join.value = 'or';
    join.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(changed[changed.length - 1]?.children).toEqual([
      path('is', 'a'),
      { ...path('is', 'b'), join: 'or' },
      path('is', 'c'),
    ]);
    expect(joinAt(el, 2).value).toBe('and');
    const details = control<HTMLDetailsElement>(el, '.tr-expression-preview');
    expect(details.open).toBe(false);
    const preview = control<HTMLElement>(details, 'code').textContent ?? '';
    expect(preview).toMatch(/"a".*OR.*"b".*AND.*"c"/i);
    expect([...joinAt(el, 1).options].map((option) => option.value)).toEqual(['and', 'or']);
  });

  // NOT is no longer an authoring control; saved negations remain visible and removable.
  it('labels saved negation and removes it through the row menu', async () => {
    const { el, changed } = draw({
      kind: 'group',
      children: [{ ...path('is', 'a'), negated: true }],
    });
    expect(el.querySelector('.tr-negation, .tr-root-negation')).toBeNull();
    expect(el.querySelector('.tr-legacy-negation')?.textContent).toBeTruthy();
    await menuAction(rowAt(el, 0), strings.when.removeNegation);
    expect(changed[changed.length - 1]?.children[0]?.negated).toBeUndefined();
    expect(el.querySelector('.tr-legacy-negation')).toBeNull();
  });

  it('wraps contiguous selected operands and preserves their incoming and internal joins', async () => {
    const initial: Group = {
      kind: 'group',
      children: [
        path('is', 'a'),
        { ...path('is', 'b'), join: 'or' },
        { ...path('is', 'c'), negated: true },
      ],
    };
    const { el, changed } = draw(initial);
    await click(el, '.tr-when-toolbar > button');
    const groupButton = control<HTMLButtonElement>(el, '.tr-when-toolbar > button.mod-cta');
    expect(groupButton.disabled).toBe(true);
    await click(rowAt(el, 1), '.tr-row-handle input');
    await click(rowAt(el, 2), '.tr-row-handle input');
    expect(groupButton.disabled).toBe(false);
    await click(el, '.tr-when-toolbar > button.mod-cta');
    expect(changed[changed.length - 1]).toEqual({
      kind: 'group',
      children: [
        path('is', 'a'),
        {
          kind: 'group',
          join: 'or',
          children: [path('is', 'b'), { ...path('is', 'c'), negated: true }],
        },
      ],
    });
    expect(el.querySelector('.tr-undo')?.textContent).toBe(strings.when.undoGroup);
    expect(el.querySelectorAll('.tr-filter-group > .tr-group-children > .tr-filter')).toHaveLength(
      2,
    );
  });

  it('does not group noncontiguous selections', async () => {
    const { el, changed } = draw(group('and', path('is', 'a'), path('is', 'b'), path('is', 'c')));
    await click(el, '.tr-when-toolbar > button');
    await click(rowAt(el, 0), '.tr-row-handle input');
    await click(rowAt(el, 2), '.tr-row-handle input');
    expect(control<HTMLButtonElement>(el, '.tr-when-toolbar > button.mod-cta').disabled).toBe(true);
    expect(changed).toEqual([]);
  });

  it('ungroups a group and undo restores its exact tree', async () => {
    const initial = group('and', path('is', 'a'), group('or', path('is', 'b'), path('is', 'c')));
    const { el, changed } = draw(initial);
    expect(el.querySelector('.tr-undo')).toBeNull();
    await menuAction(rowAt(el, 1), strings.when.ungroup);
    expect(changed[changed.length - 1]?.children).toHaveLength(3);
    expect(el.querySelector('.tr-filter-group')).toBeNull();
    await click(el, '.tr-undo');
    expect(changed[changed.length - 1]).toEqual(initial);
    expect(el.querySelector('.tr-filter-group')).not.toBeNull();
    expect(el.querySelector('.tr-undo')).toBeNull();
  });

  it('keeps a saved negated group parenthesized until its negation is removed', async () => {
    const { el } = draw(group('and', { ...group('and', path('is', 'a')), negated: true }));
    await click(rowAt(el, 0), '.tr-row-menu');
    expect(menuButton(strings.when.ungroup).disabled).toBe(true);
    await menuAction(rowAt(el, 0), strings.when.removeNegation);
    await click(rowAt(el, 0), '.tr-row-menu');
    expect(menuButton(strings.when.ungroup).disabled).toBe(false);
  });

  it('offers grouping only when adjacent siblings exist and labels undo by operation', async () => {
    const { el, changed } = draw(group('and', path('is', 'a'), path('is', 'b')));
    expect(el.querySelector('.tr-when-toolbar button')?.textContent).toBe('Group conditions');
    expect(el.querySelector('.tr-row-handle input')).toBeNull();
    await menuAction(rowAt(el, 0), strings.when.moveDown);
    expect(changed[changed.length - 1]?.children).toEqual([path('is', 'b'), path('is', 'a')]);
    expect(el.querySelector('.tr-undo')?.textContent).toBe(strings.when.undoMove);
    await click(el, '.tr-undo');
    expect(changed[changed.length - 1]?.children).toEqual([path('is', 'a'), path('is', 'b')]);
    expect(el.querySelector('.tr-undo')).toBeNull();
    await menuAction(rowAt(el, 1), strings.when.remove);
    expect(el.querySelector('.tr-when-toolbar')).toBeNull();
  });

  it('shows required-field validation after blur and hides incomplete preview', async () => {
    const { el } = draw(group('and', property('', 'is', '')));
    expect(el.querySelector('.tr-expression-preview')).toBeNull();
    expect(el.querySelector('.tr-field-error')).toBeNull();
    const key = control<HTMLInputElement>(el, '.tr-key');
    key.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await vi.waitFor(() => expect(key.getAttribute('aria-invalid')).toBe('true'));
    const keyError = control<HTMLElement>(key.parentElement ?? el, '.tr-field-error');
    expect(keyError.textContent).toBe(strings.when.keyRequired);
    expect(key.parentElement?.className).toBe('tr-input-stack');
    expect(key.getAttribute('aria-describedby')).toBe(keyError.id);
    expect(keyError.id).not.toBe('');
    const value = control<HTMLInputElement>(el, '.tr-value');
    value.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await vi.waitFor(() => expect(value.getAttribute('aria-invalid')).toBe('true'));
    const valueError = control<HTMLElement>(value.parentElement ?? el, '.tr-field-error');
    expect(valueError.textContent).toBe(strings.when.valueRequired);
    expect(value.getAttribute('aria-describedby')).toBe(valueError.id);
    expect(valueError.id).not.toBe(keyError.id);
    expect(el.querySelector('.tr-condition-fields > .tr-field-error')).toBeNull();
    key.value = 'status';
    key.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    value.value = 'open';
    value.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(el.querySelector('.tr-field-error')).toBeNull());
    expect(key.hasAttribute('aria-describedby')).toBe(false);
    expect(value.hasAttribute('aria-describedby')).toBe(false);
    expect(control<HTMLDetailsElement>(el, '.tr-expression-preview').open).toBe(false);
  });

  it('preserves the operand join and NOT when changing its field', async () => {
    const initial: Group = {
      kind: 'group',
      children: [path('is', 'a'), { ...path('is', 'b'), join: 'or', negated: true }],
    };
    const { el, changed } = draw(initial);
    await choose(rowAt(el, 1), '.tr-field', 'property');
    expect(changed[changed.length - 1]?.children[1]).toMatchObject({
      field: 'property',
      join: 'or',
      negated: true,
    });
  });
});

describe('dragging a row', () => {
  /* "The handle is there" is not "dragging works": the defect that reached the
   * user passed every check that stopped at the markup.
   *
   * Element refs reach the sensor after render, and drag state publishes on a
   * later frame. Wait for those boundaries before sending the next gesture. */
  const settle = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

  /* A mouse on the handle needs no threshold - the library starts the drag on
   * the press - so the events say which pointer they are. */
  const at = (type: string, y: number): PointerEvent =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: y,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse',
    });

  const press = (handle: HTMLElement): void => {
    handle.dispatchEvent(at('pointerdown', 0));
  };

  const moveTo = (y: number): void => {
    document.dispatchEvent(at('pointermove', y));
  };

  const release = (y: number): void => {
    document.dispatchEvent(at('pointerup', y));
  };

  function handleOf(el: HTMLElement, index: number): HTMLElement {
    const handle = rowAt(el, index).querySelector<HTMLElement>('.tr-grip');
    if (handle === null) throw new Error('no handle');
    return handle;
  }

  it('picks the row up once the cursor has travelled', async () => {
    const { el } = draw(group('and', path('contains', 'a'), path('contains', 'b')));

    await settle();
    press(handleOf(el, 0));
    await settle();
    moveTo(40);
    await settle();

    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(1),
    );

    release(40);
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(0),
    );
  });

  // dnd-kit 0.5 activates a mouse press on the explicit handle without a distance threshold.
  it('picks the row up on the handle before the cursor has travelled', async () => {
    const { el } = draw(group('and', path('contains', 'a'), path('contains', 'b')));

    await settle();
    press(handleOf(el, 0));
    await settle();
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(1),
    );

    release(2);
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(0),
    );
  });

  it('moves and releases in the owning document outside the main document frame tree', async () => {
    // Unlike an iframe, a settings popout cannot be discovered from the main document.
    const owner = document.implementation.createHTMLDocument('Settings');
    const { el, changed } = draw(
      group('and', path('contains', 'a'), path('contains', 'b')),
      'markdown',
      owner,
    );

    await settle();
    press(handleOf(el, 0));
    await settle();
    owner.dispatchEvent(at('pointermove', 40));
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(1),
    );

    expect(rowAt(el, 0).ownerDocument).toBe(owner);
    owner.dispatchEvent(at('pointerup', 40));
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(0),
    );
    expect(changed).toHaveLength(0);
  });
  it('starts and cancels keyboard dragging in the owning document', async () => {
    const owner = document.implementation.createHTMLDocument('Settings');
    const { el, changed } = draw(group('and', path('is', 'a'), path('is', 'b')), 'markdown', owner);
    await settle();
    const handle = handleOf(el, 0);
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(1),
    );
    owner.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await vi.waitFor(() =>
      expect(el.querySelectorAll('.tr-dragging:not([data-dnd-placeholder])')).toHaveLength(0),
    );
    expect(changed).toEqual([]);
  });
});

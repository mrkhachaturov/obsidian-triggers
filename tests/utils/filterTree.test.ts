/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';
import { type Group, MAX_DEPTH } from '../../src/types/rule';
import {
  appendTo,
  at,
  canGroupSelection,
  groupSelection,
  moveTo,
  newGroup,
  removeAt,
  replaceAt,
  rows,
  setConjunction,
  setNegated,
  ungroupAt,
} from '../../src/utils/filterTree';
import { group, path, property } from '../factories';

/* Where the tree is edited from: the screen holds an address, never a node. */

const tree: Group = group(
  'and',
  path('inFolder', 'Atlas'),
  group('or', property('due', 'exists'), property('tags', 'is', 'nav')),
);

describe('rows', () => {
  it('flattens parents before their children, carrying the indent', () => {
    expect(
      rows(tree).map((row) => [row.path.join('.'), row.depth, row.conjunction, row.first]),
    ).toEqual([
      ['0', 0, 'and', true],
      ['1', 0, 'and', false],
      ['1.0', 1, 'and', true],
      ['1.1', 1, 'or', false],
    ]);
  });
});

describe('at', () => {
  it('resolves an address', () => {
    expect(at(tree, [1, 0])).toEqual(property('due', 'exists'));
  });

  /* A page can outlive the tree it was drawn from. */
  it('returns null for an address that no longer resolves', () => {
    expect(at(tree, [9])).toBeNull();
    expect(at(tree, [0, 0])).toBeNull();
  });
});

describe('replaceAt', () => {
  it('replaces one node and leaves the original alone', () => {
    const next = replaceAt(tree, [1, 0], property('due', 'missing'));

    expect(at(next, [1, 0])).toEqual(property('due', 'missing'));
    expect(at(tree, [1, 0])).toEqual(property('due', 'exists'));
  });

  it('changes nothing when the address is gone', () => {
    expect(replaceAt(tree, [4, 2], property('x', 'exists'))).toEqual(tree);
  });
});

describe('removeAt', () => {
  it('removes a nested row without touching its siblings', () => {
    const next = removeAt(tree, [1, 0]);

    expect(rows(next).map((row) => row.path.join('.'))).toEqual(['0', '1', '1.0']);
    expect(at(next, [1, 0])).toEqual(property('tags', 'is', 'nav'));
  });

  it('removes a whole group, and what is inside it goes too', () => {
    expect(rows(removeAt(tree, [1]))).toHaveLength(1);
  });
});

describe('appendTo', () => {
  it('appends to the root when the address is empty', () => {
    expect(appendTo(tree, [], newGroup()).children).toHaveLength(3);
  });

  it('appends inside the group it names', () => {
    const next = appendTo(tree, [1], property('type', 'is', 'task'));
    expect(at(next, [1, 2])).toEqual(property('type', 'is', 'task'));
  });

  it('refuses to append inside a row that is not a group', () => {
    expect(appendTo(tree, [0], newGroup())).toEqual(tree);
  });
});

describe('setConjunction', () => {
  it('changes only the addressed operand', () => {
    const next = setConjunction(tree, [1], 'or');
    expect(next.children[1]?.join).toBe('or');
    expect(at(next, [1, 1])?.join).toBe('or');
    expect(next.children[0]?.join).toBeUndefined();
    expect(setConjunction(next, [1, 1], 'and').children[1]).toMatchObject({
      children: [{}, { join: 'and' }],
    });
  });

  it('ignores the root and first children', () => {
    expect(setConjunction(tree, [], 'or')).toBe(tree);
    expect(setConjunction(tree, [0], 'or')).toBe(tree);
    expect(setConjunction(tree, [1, 0], 'or')).toBe(tree);
  });
});

describe('moveTo', () => {
  /* Removing the node shifts every later sibling, so a row dragged downwards
   * lands one place short unless the address is recomputed after the removal. */
  it('moves a row down among its siblings, landing where it was dropped', () => {
    const flat = group(
      'and',
      property('a', 'exists'),
      property('b', 'exists'),
      property('c', 'exists'),
    );

    expect(names(moveTo(flat, [0], [2], 'after'))).toEqual(['b', 'c', 'a']);
  });

  it('moves a row up among its siblings', () => {
    const flat = group(
      'and',
      property('a', 'exists'),
      property('b', 'exists'),
      property('c', 'exists'),
    );

    expect(names(moveTo(flat, [2], [0], 'before'))).toEqual(['c', 'a', 'b']);
  });

  it('moves a row out of one group and into another', () => {
    const nested = group(
      'and',
      group('or', property('a', 'exists'), property('b', 'exists')),
      group('or', property('c', 'exists')),
    );

    const next = moveTo(nested, [0, 0], [1, 0], 'after');

    expect(names(at(next, [0]) as Group)).toEqual(['b']);
    expect(names(at(next, [1]) as Group)).toEqual(['c', 'a']);
  });

  it('drops a row inside the group it was dropped on', () => {
    const nested = group('and', property('a', 'exists'), group('or', property('b', 'exists')));

    const next = moveTo(nested, [0], [1], 'inside');

    expect(next.children).toHaveLength(1);
    expect(names(at(next, [0]) as Group)).toEqual(['b', 'a']);
  });

  /* The branch would leave with it, and the tree would lose everything under. */
  it('refuses to put a group inside itself', () => {
    const nested = group('and', group('or', property('a', 'exists')));

    expect(moveTo(nested, [0], [0, 0], 'after')).toEqual(nested);
    expect(moveTo(nested, [0], [0], 'inside')).toEqual(nested);
  });

  it('changes nothing when the address is gone', () => {
    const flat = group('and', property('a', 'exists'));

    expect(moveTo(flat, [7], [0], 'after')).toEqual(flat);
    expect(moveTo(flat, [], [0], 'after')).toEqual(flat);
  });
});

/** The property names of a group's own rows, in order. */
function names(node: Group): string[] {
  return node.children.map((child) => ('key' in child ? child.key : 'group'));
}

describe('boolean modifiers', () => {
  it('preserves join and NOT when replacing an operand', () => {
    const source = setNegated(setConjunction(tree, [1], 'or'), [1], true);
    expect(at(replaceAt(source, [1], property('x', 'exists')), [1])).toEqual({
      ...property('x', 'exists'),
      join: 'or',
      negated: true,
    });
    expect(setNegated(source, [1], false).children[1]?.negated).toBeUndefined();
    expect(setNegated(tree, [], true).negated).toBe(true);
  });
});

describe('parentheses', () => {
  const mixed: Group = {
    kind: 'group',
    children: [
      property('a', 'exists'),
      { ...property('b', 'exists'), join: 'or' },
      { ...property('c', 'exists'), join: 'and', negated: true },
      { ...property('d', 'exists'), join: 'or' },
    ],
  };

  it('groups contiguous operands preserving incoming and internal connectors', () => {
    const next = groupSelection(mixed, [[2], [1]]);
    expect(next.children).toEqual([
      mixed.children[0],
      {
        kind: 'group',
        join: 'or',
        children: [property('b', 'exists'), mixed.children[2]],
      },
      mixed.children[3],
    ]);
    expect(ungroupAt(next, [1])).toEqual(mixed);
    expect(groupSelection(mixed, [[0], [1]]).children[0]?.join).toBeUndefined();
  });

  it('rejects disjoint, duplicate, missing, root, and cross-parent selections', () => {
    for (const paths of [[[0], [2]], [[1], [1]], [[0], [9]], [[], [0]], [[0]], [[0], [1, 0]]]) {
      expect(canGroupSelection(mixed, paths)).toBe(false);
      expect(groupSelection(mixed, paths)).toBe(mixed);
    }
  });

  it('keeps negated groups intact and refuses to ungroup the root', () => {
    const grouped = groupSelection(mixed, [[0], [1]]);
    const negated = setNegated(grouped, [0], true);
    expect(ungroupAt(negated, [0])).toBe(negated);
    expect(ungroupAt(grouped, [])).toBe(grouped);
  });

  it('preserves joins during moves and clears new first-child connectors', () => {
    const moved = moveTo(mixed, [1], [3], 'after');
    expect(names(moved)).toEqual(['a', 'c', 'd', 'b']);
    expect(moved.children.map((child) => child.join)).toEqual([undefined, 'and', 'or', 'or']);
    const first = moveTo(mixed, [1], [0], 'before');
    expect(first.children[0]?.join).toBeUndefined();
    expect(removeAt(mixed, [0]).children[0]?.join).toBeUndefined();
  });

  it('carries the connector across groups and normalizes both first operands', () => {
    const source: Group = {
      kind: 'group',
      children: [
        {
          kind: 'group',
          children: [property('a', 'exists'), { ...property('b', 'exists'), join: 'or' }],
        },
        { kind: 'group', children: [property('c', 'exists')] },
      ],
    };
    const moved = moveTo(source, [0, 1], [1], 'inside');
    expect(at(moved, [1, 1])?.join).toBe('or');
    const movedFirst = moveTo(source, [0, 0], [1, 0], 'before');
    expect(at(movedFirst, [0, 0])?.join).toBeUndefined();
    expect(at(movedFirst, [1, 0])?.join).toBeUndefined();
  });

  it('does not lose the source on an invalid destination', () => {
    expect(moveTo(mixed, [0], [99], 'after')).toBe(mixed);
    expect(moveTo(mixed, [0], [1], 'inside')).toBe(mixed);
    expect(moveTo(mixed, [0], [], 'before')).toBe(mixed);
  });
});

describe('depth limit', () => {
  let deep: Group = group('and', property('a', 'exists'), property('b', 'exists'));
  for (let i = 0; i < MAX_DEPTH - 1; i++) deep = group('and', deep);
  const parent = Array<number>(MAX_DEPTH - 1).fill(0);

  it('prevents creating groups whose children could not be reloaded', () => {
    expect(
      canGroupSelection(deep, [
        [...parent, 0],
        [...parent, 1],
      ]),
    ).toBe(false);
    expect(
      groupSelection(deep, [
        [...parent, 0],
        [...parent, 1],
      ]),
    ).toBe(deep);
    expect(appendTo(deep, parent, group('and', property('c', 'exists')))).toBe(deep);
  });

  it('allows a group at the deepest valid group depth with leaf children', () => {
    const holder = parent.slice(0, -1);
    const added = appendTo(deep, holder, group('and', property('c', 'exists')));
    expect(added).not.toBe(deep);
    expect(at(added, [...holder, 1, 0])).toEqual(property('c', 'exists'));
    expect(appendTo(deep, parent, property('c', 'exists'))).not.toBe(deep);
  });

  it('rejects a move exceeding depth before removing its source', () => {
    const source = appendTo(deep, [], group('and', property('c', 'exists')));
    expect(moveTo(source, [1], parent, 'inside')).toBe(source);
    expect(appendTo(deep, parent, property('c', 'exists'))).not.toBe(deep);
  });
});

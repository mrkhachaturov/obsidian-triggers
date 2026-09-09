/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { type Conjunction, type Filter, type Group, isGroup, MAX_DEPTH } from '../types/rule';

/** An immutable address from the root group. */
export type Path = readonly number[];

export interface Row {
  readonly filter: Filter;
  readonly path: Path;
  readonly depth: number;
  /** This operand's incoming connective. The first child has none. */
  readonly conjunction: Conjunction;
  readonly first: boolean;
}

export function rows(root: Group, path: Path = [], depth = 0): Row[] {
  return root.children.flatMap((child, index) => {
    const here: Row = {
      filter: child,
      path: [...path, index],
      depth,
      conjunction: child.join ?? 'and',
      first: index === 0,
    };
    return isGroup(child) ? [here, ...rows(child, here.path, depth + 1)] : [here];
  });
}

export function at(root: Group, path: Path): Filter | null {
  let node: Filter = root;
  for (const index of path) {
    if (!isGroup(node) || !Number.isInteger(index) || index < 0) return null;
    const child: Filter | undefined = node.children[index];
    if (child === undefined) return null;
    node = child;
  }
  return node;
}

/** Changing a field or operator preserves the operand's boolean modifiers. */
export function replaceAt(root: Group, path: Path, next: Filter): Group {
  return edit(root, path, (node) => {
    const { join: _join, negated: _negated, ...value } = next;
    return {
      ...value,
      ...(node.join === undefined ? {} : { join: node.join }),
      ...(node.negated ? { negated: true as const } : {}),
    };
  });
}

export function removeAt(root: Group, path: Path): Group {
  const index = path[path.length - 1];
  if (index === undefined || at(root, path) === null) return root;
  return edit(root, path.slice(0, -1), (node) =>
    isGroup(node)
      ? { ...node, children: normalize(node.children.filter((_child, i) => i !== index)) }
      : node,
  );
}

export function appendTo(root: Group, path: Path, child: Filter): Group {
  if (!fits(child, path.length + 1)) return root;
  return edit(root, path, (node) =>
    isGroup(node) ? { ...node, children: normalize([...node.children, child]) } : node,
  );
}

/** Each non-first operand owns its incoming AND/OR. */
export function setConjunction(root: Group, path: Path, conjunction: Conjunction): Group {
  if (path.length === 0 || path[path.length - 1] === 0) return root;
  return edit(root, path, (node) => ({ ...node, join: conjunction }));
}

export function setNegated(root: Group, path: Path, negated: boolean): Group {
  return edit(root, path, (node) => {
    const { negated: _negated, ...value } = node;
    return negated ? { ...value, negated: true } : value;
  });
}

function edit(root: Group, path: Path, change: (node: Filter) => Filter): Group {
  const changed = walk(root, path, change);
  return isGroup(changed) ? changed : root;
}

function walk(node: Filter, path: Path, change: (node: Filter) => Filter): Filter {
  if (path.length === 0) return change(node);
  if (!isGroup(node)) return node;
  const [index, ...rest] = path;
  if (index === undefined || node.children[index] === undefined) return node;
  const previous = node.children[index];
  const next = walk(previous, rest, change);
  if (previous === next) return node;
  return { ...node, children: node.children.map((child, i) => (i === index ? next : child)) };
}

/** Clear the meaningless incoming connector of the first operand. */
function normalize(children: readonly Filter[]): readonly Filter[] {
  return children.map((child, index) => {
    if (index !== 0 || child.join === undefined) return child;
    const { join: _join, ...value } = child;
    return value;
  });
}

function fits(node: Filter, depth: number): boolean {
  return isGroup(node)
    ? depth < MAX_DEPTH && node.children.every((child) => fits(child, depth + 1))
    : depth <= MAX_DEPTH;
}

export type Position = 'before' | 'after' | 'inside';

export function moveTo(root: Group, from: Path, to: Path, position: Position): Group {
  if (from.length === 0 || contains(from, to)) return root;
  const node = at(root, from);
  const destination = at(root, to);
  if (node === null || destination === null) return root;
  if (position === 'inside' ? !isGroup(destination) : to.length === 0) return root;
  if (!fits(node, position === 'inside' ? to.length + 1 : to.length)) return root;

  const without = removeAt(root, from);
  const target = shifted(to, from);
  if (position === 'inside') return appendTo(without, target, node);
  const index = target[target.length - 1];
  if (index === undefined) return root;
  return edit(without, target.slice(0, -1), (holder) => {
    if (!isGroup(holder)) return holder;
    const children = [...holder.children];
    children.splice(index + (position === 'after' ? 1 : 0), 0, node);
    return { ...holder, children: normalize(children) };
  });
}

function contains(from: Path, to: Path): boolean {
  return to.length >= from.length && from.every((step, index) => to[index] === step);
}

function shifted(to: Path, from: Path): Path {
  const level = from.length - 1;
  const above = from.slice(0, level).every((step, index) => to[index] === step);
  const here = to[level];
  const removed = from[level];
  if (!above || here === undefined || removed === undefined || here <= removed) return to;
  return [...to.slice(0, level), here - 1, ...to.slice(level + 1)];
}

function selection(
  root: Group,
  paths: readonly Path[],
): { parent: Path; start: number; count: number } | null {
  if (paths.length < 2) return null;
  const first = paths[0];
  if (first === undefined || first.length === 0) return null;
  const parent = first.slice(0, -1);
  const indexes: number[] = [];
  for (const path of paths) {
    if (path.length !== first.length || !contains(parent, path)) return null;
    const node = at(root, path);
    const index = path[path.length - 1];
    if (node === null || index === undefined || !fits(node, path.length + 1)) return null;
    indexes.push(index);
  }
  indexes.sort((a, b) => a - b);
  const start = indexes[0];
  if (start === undefined || indexes.some((index, i) => index !== start + i)) return null;
  return { parent, start, count: indexes.length };
}

export function canGroupSelection(root: Group, paths: readonly Path[]): boolean {
  return selection(root, paths) !== null;
}

/** Parentheses retain the first operand's external join and all internal joins. */
export function groupSelection(root: Group, paths: readonly Path[]): Group {
  const selected = selection(root, paths);
  if (selected === null) return root;
  return edit(root, selected.parent, (node) => {
    if (!isGroup(node)) return node;
    const children = [...node.children];
    const chosen = children.slice(selected.start, selected.start + selected.count);
    const join = chosen[0]?.join;
    const wrapper: Group = {
      kind: 'group',
      children: normalize(chosen),
      ...(join === undefined ? {} : { join }),
    };
    children.splice(selected.start, selected.count, wrapper);
    return { ...node, children: normalize(children) };
  });
}

/** Removing parentheses is explicit; a negated group must keep its NOT scope. */
export function ungroupAt(root: Group, path: Path): Group {
  const node = at(root, path);
  const index = path[path.length - 1];
  if (index === undefined || node === null || !isGroup(node) || node.negated) return root;
  return edit(root, path.slice(0, -1), (parent) => {
    if (!isGroup(parent)) return parent;
    const expanded = node.children.map((child, i) => {
      if (i !== 0) return child;
      const { join: _join, ...value } = child;
      return { ...value, ...(node.join === undefined ? {} : { join: node.join }) };
    });
    const children = [...parent.children];
    children.splice(index, 1, ...expanded);
    return { ...parent, children: normalize(children) };
  });
}

export function newGroup(): Group {
  return { kind: 'group', children: [] };
}

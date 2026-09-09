/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { StringPath } from '../i18n/paths';
import type { Field, PathOp, PropertyOp, TextOp } from './rule';

/* The settings screen and docs/reference.md are built from these lists, so an
 * operator cannot exist in one and be missing from the other.
 *
 * This file and the locales it names import nothing from `obsidian` at runtime,
 * which is what lets the reference generator run them under plain Node instead of
 * bundling the plugin to get at them. Keep it that way, and write the `.ts` in
 * their import paths - Node resolves nothing without it. */

export type Op = PathOp | PropertyOp;

export interface OperatorSpec {
  readonly op: Op;
  readonly label: StringPath;
  /** What it holds when, for the generated reference. */
  readonly holds: string;
  /** The three that ask about presence take no value, and the field is hidden. */
  readonly value: boolean;
}

export const OPERATORS: readonly OperatorSpec[] = [
  { op: 'is', label: 'ops.is', holds: 'the value is exactly this', value: true },
  { op: 'contains', label: 'ops.contains', holds: 'the value has this inside it', value: true },
  { op: 'notContains', label: 'ops.notContains', holds: 'it does not', value: true },
  { op: 'startsWith', label: 'ops.startsWith', holds: 'the value begins with this', value: true },
  { op: 'endsWith', label: 'ops.endsWith', holds: 'the value ends with this', value: true },
  {
    op: 'inFolder',
    label: 'ops.inFolder',
    holds: 'the file sits under this folder, at any depth',
    value: true,
  },
  { op: 'notInFolder', label: 'ops.notInFolder', holds: 'it does not', value: true },
  {
    op: 'exists',
    label: 'ops.exists',
    holds: 'the property is present, whatever it holds',
    value: false,
  },
  { op: 'missing', label: 'ops.missing', holds: 'the property is not present', value: false },
  {
    op: 'empty',
    label: 'ops.empty',
    holds: 'the property is present and holds nothing',
    value: false,
  },
];

const TEXT_OPS: readonly TextOp[] = ['is', 'contains', 'notContains', 'startsWith', 'endsWith'];

export interface FieldSpec {
  readonly field: Field;
  readonly label: StringPath;
  readonly ops: readonly Op[];
  /** The greyed-out example in the value field, in the shape it must be typed. */
  readonly hint: StringPath;
  /** A row needs a property name; the other fields are the one thing they name. */
  readonly key: boolean;
  /* The view types that can ever produce this field. Absent means every one of
   * them: a row that could never hold is not offered where it cannot. */
  readonly views?: readonly string[];
}

export const FIELDS: readonly FieldSpec[] = [
  {
    field: 'path',
    label: 'fields.path',
    ops: [...TEXT_OPS, 'inFolder', 'notInFolder'],
    hint: 'when.pathHint',
    key: false,
  },
  {
    field: 'viewName',
    label: 'fields.viewName',
    ops: TEXT_OPS,
    hint: 'when.viewNameHint',
    key: false,
    /* Only a Base has a current view, and only it publishes the name. */
    views: ['bases'],
  },
  {
    field: 'property',
    label: 'fields.property',
    ops: [...TEXT_OPS, 'exists', 'missing', 'empty'],
    hint: 'when.valueHint',
    key: true,
  },
];

/** Built once, so a lookup is not a scan on every rendered row. */
export const OPERATOR = new Map(OPERATORS.map((spec) => [spec.op, spec]));

export function fieldSpec(field: Field): FieldSpec {
  return FIELDS.find((spec) => spec.field === field) ?? (FIELDS[0] as FieldSpec);
}

export type VariableField = 'viewType' | 'path' | 'viewName' | 'rule' | 'frontmatter';

export interface VariableSpec {
  readonly field: VariableField;
  /** The name a template writes. A literal, so the generator can read it. */
  readonly name: string;
  /** What it holds, in English, for the generated reference. */
  readonly holds: string;
}

/** The public variable set a QuickAdd action receives. Adding one is adding a row here. */
export const VARIABLES: readonly VariableSpec[] = [
  { field: 'viewType', name: 'trigger.viewType', holds: '`markdown`, `bases`, `canvas`, …' },
  {
    field: 'path',
    name: 'trigger.path',
    holds: 'vault path of the file in view, empty when there is none',
  },
  {
    field: 'viewName',
    name: 'trigger.viewName',
    holds: "the Base's current view, empty elsewhere",
  },
  { field: 'rule', name: 'trigger.rule', holds: 'the name of the rule that fired' },
  {
    field: 'frontmatter',
    name: 'trigger.fm.<key>',
    holds: 'one per frontmatter property, as text',
  },
];

/* Built once, so the runner names a variable from the same row the reference does. */
export const VARIABLE_NAME = Object.fromEntries(
  VARIABLES.map((variable) => [variable.field, variable.name]),
) as Record<VariableField, string>;

/** `trigger.fm.<key>` without the placeholder, for building one name per property. */
export const FRONTMATTER_PREFIX = VARIABLE_NAME.frontmatter.replace('.<key>', '');

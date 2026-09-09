/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/dom';
import { OptimisticSortingPlugin } from '@dnd-kit/dom/sortable';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Menu, setIcon } from 'obsidian';
import type { VNode } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { strings } from '../i18n';
import { t } from '../i18n/paths';
import { FIELDS, fieldSpec, OPERATOR } from '../types/registry';
import {
  type Conjunction,
  type Field,
  type Filter,
  type Group,
  isGroup,
  MAX_DEPTH,
  type Test,
} from '../types/rule';
import { looksLikePattern } from '../utils/compare';
import { conditionIncomplete } from '../utils/conditionState';
import {
  appendTo,
  canGroupSelection,
  groupSelection,
  moveTo,
  newGroup,
  type Path,
  type Row,
  removeAt,
  replaceAt,
  rows,
  setConjunction,
  setNegated,
  ungroupAt,
} from '../utils/filterTree';
import { describeCondition } from '../utils/match';
import { newTest } from '../utils/readData';

const CONJUNCTIONS: readonly Conjunction[] = ['and', 'or'];

/* React's types stopped passing children implicitly, and Preact's JSX still
 * does; the seam is named once here rather than cast at the call site. */
const Provider = DragDropProvider as unknown as (props: {
  readonly onDragEnd: (event: DragEndEvent) => void;
  readonly onDragStart: (event: DragStartEvent) => void;
  readonly children: unknown;
}) => VNode;

/* Obsidian draws its own icons, so a button says what it does in the vocabulary
 * the rest of the app uses rather than in characters somebody typed. */
function Icon({ name }: { readonly name: string }): VNode {
  return (
    <span
      class="tr-icon"
      ref={(element) => {
        if (element !== null) setIcon(element, name);
      }}
    />
  );
}

export interface WhenEditorProps {
  readonly when: Group;
  readonly viewType: string;
  readonly onChange: (next: Group) => void;
}

export function WhenEditor({ when, viewType, onChange }: WhenEditorProps): VNode {
  const [tree, setTree] = useState(when);
  const [dragSource, setDragSource] = useState<Path | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<readonly Path[]>([]);
  const [history, setHistory] = useState<readonly { tree: Group; label: string }[]>([]);
  const root = useRef<HTMLDivElement | null>(null);

  const edit = (next: Group, label: string = strings.when.undo): void => {
    if (next === tree) return;
    setHistory((previous) => [...previous.slice(-19), { tree, label }]);
    setTree(next);
    setSelected([]);
    onChange(next);
  };

  const undo = (): void => {
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    setHistory(history.slice(0, -1));
    setSelected([]);
    setTree(previous.tree);
    onChange(previous.tree);
  };

  const select = (path: Path, checked: boolean): void => {
    setSelected((previous) =>
      checked ? [...previous, path] : previous.filter((entry) => key(entry) !== key(path)),
    );
  };

  const drawn = rows(tree);
  const dropped = (event: DragEndEvent): void => {
    setDragSource(null);
    if (event.canceled) return;
    const from = pathOf(event.operation.source?.id);
    const to = pathOf(event.operation.target?.id);
    if (from === null || to === null || key(from) === key(to)) return;
    const target = drawn.find((row) => key(row.path) === key(to));
    const inside = target !== undefined && isGroup(target.filter);
    edit(
      moveTo(tree, from, to, inside ? 'inside' : after(from, to) ? 'after' : 'before'),
      strings.when.undoMove,
    );
  };

  const focusEditor = (): void => {
    queueMicrotask(() => root.current?.querySelector<HTMLButtonElement>('.tr-grip')?.focus());
  };

  const branch = (parent: Path): VNode[] =>
    drawn
      .filter((row) => key(row.path.slice(0, -1)) === key(parent))
      .map((row) => (
        <FilterRow
          key={key(row.path)}
          row={row}
          dragSource={dragSource}
          viewType={viewType}
          tree={tree}
          onEdit={edit}
          selecting={selecting}
          selected={selected}
          onSelect={select}
        >
          {isGroup(row.filter) ? branch(row.path) : null}
        </FilterRow>
      ));

  const canSelect = drawn.some((row) => {
    const next = [...row.path.slice(0, -1), (row.path[row.path.length - 1] ?? 0) + 1];
    return canGroupSelection(tree, [row.path, next]);
  });
  const lastEdit = history[history.length - 1];
  const hasConditions = tree.children.length > 0;

  return (
    <div class="tr-when" ref={root}>
      {tree.negated ? (
        <div class="tr-legacy-negation">
          <p>{strings.when.legacyNegatedGroup}</p>
          <button type="button" onClick={() => edit(setNegated(tree, [], false))}>
            {strings.when.removeNegation}
          </button>
        </div>
      ) : null}
      {!hasConditions ? (
        <div class="tr-when-empty">
          <p>
            {tree.negated
              ? strings.when.emptyNegated
              : viewType === 'markdown'
                ? strings.when.allMarkdown
                : strings.when.allView}
          </p>
          <p>{strings.when.emptyHint}</p>
        </div>
      ) : null}

      {hasConditions && (canSelect || selecting) ? (
        <div class="tr-when-toolbar">
          {selecting ? (
            <>
              <button
                type="button"
                class="mod-cta"
                disabled={!canGroupSelection(tree, selected)}
                onClick={() => {
                  edit(groupSelection(tree, selected), strings.when.undoGroup);
                  setSelecting(false);
                  focusEditor();
                }}
              >
                {strings.when.groupSelected}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelecting(false);
                  setSelected([]);
                }}
              >
                {strings.when.cancelSelection}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSelecting(true)}>
              {strings.when.selectRows}
            </button>
          )}
        </div>
      ) : null}
      {selecting && hasConditions ? (
        <p class="tr-selection-hint">{strings.when.selectionHint}</p>
      ) : null}
      {hasConditions ? (
        <Provider
          onDragStart={(event) => setDragSource(pathOf(event.operation.source?.id))}
          onDragEnd={dropped}
        >
          {branch([])}
        </Provider>
      ) : null}

      <div class="tr-when-add">
        <button
          type="button"
          class={hasConditions ? '' : 'mod-cta'}
          onClick={() =>
            edit(appendTo(tree, [], newTest(nextField(tree, viewType))), strings.when.undoAdd)
          }
        >
          {strings.when.add}
        </button>
      </div>
      {lastEdit ? (
        <button type="button" class="tr-undo" onClick={undo}>
          {lastEdit.label}
        </button>
      ) : null}

      {hasConditions && !conditionIncomplete(tree) ? (
        <details class="tr-expression-preview">
          <summary>{strings.when.expression}</summary>
          <code>{describeCondition(tree)}</code>
        </details>
      ) : null}
      {hasConditions ? (
        <details class="tr-when-help">
          <summary>{strings.when.helpTitle}</summary>
          <div class="tr-help-content">
            <dl class="tr-when-examples">
              {(['folder', 'suffix', 'status', 'missing'] as const).map((name) => {
                const example = strings.when.helpExamples[name];
                return (
                  <div key={name}>
                    <dt>{example.title}</dt>
                    <dd>{example.setup}</dd>
                  </div>
                );
              })}
            </dl>
            <p class="tr-help-connections">{strings.when.helpMultiple}</p>
            <details class="tr-regex-help">
              <summary>{strings.when.regexTitle}</summary>
              <p>{strings.when.helpRegex}</p>
              <code>{strings.when.regexExample}</code>
              <p>{strings.when.regexExplanation}</p>
            </details>
          </div>
        </details>
      ) : null}
    </div>
  );
}

interface RowProps {
  readonly row: Row;
  readonly viewType: string;
  readonly tree: Group;
  readonly onEdit: (next: Group, label?: string) => void;
}

interface SelectableRowProps extends RowProps {
  readonly dragSource: Path | null;
  readonly selecting: boolean;
  readonly selected: readonly Path[];
  readonly onSelect: (path: Path, checked: boolean) => void;
  readonly children: VNode[] | null;
}

function FilterRow({
  row,
  dragSource,
  viewType,
  tree,
  onEdit,
  selecting,
  selected,
  onSelect,
  children,
}: SelectableRowProps): VNode {
  const filter = row.filter;
  const grouped = isGroup(filter);
  const [element, setElement] = useState<Element | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  const handle = useRef<HTMLButtonElement | null>(null);
  const selectedHere = selected.some((entry) => key(entry) === key(row.path));

  // The whole group moves, while its header is the target for dropping inside its parentheses.
  const { isDragging, isDropTarget } = useSortable({
    id: key(row.path),
    index: row.path[row.path.length - 1] ?? 0,
    group: groupKey(row.path.slice(0, -1)),
    plugins: (defaults) => defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
    element,
    target,
    handle,
    accept: (source) => !key(row.path).startsWith(`${String(source.id)}.`),
  });

  const menu = (event: MouseEvent): void => {
    const anchor = event.currentTarget as HTMLButtonElement;
    const list = new Menu();
    const index = row.path[row.path.length - 1] ?? 0;
    const siblings = drawnSiblings(tree, row.path);
    const move = (targetIndex: number, position: 'before' | 'after'): void => {
      onEdit(
        moveTo(tree, row.path, [...row.path.slice(0, -1), targetIndex], position),
        strings.when.undoMove,
      );
    };
    list.addItem((item) =>
      item
        .setTitle(strings.when.moveUp)
        .setIcon('arrow-up')
        .setDisabled(index === 0)
        .onClick(() => move(index - 1, 'before')),
    );
    list.addItem((item) =>
      item
        .setTitle(strings.when.moveDown)
        .setIcon('arrow-down')
        .setDisabled(index >= siblings - 1)
        .onClick(() => move(index + 1, 'after')),
    );
    if (row.path.length > 1) {
      list.addItem((item) =>
        item
          .setTitle(strings.when.moveOut)
          .setIcon('outdent')
          .onClick(() =>
            onEdit(moveTo(tree, row.path, row.path.slice(0, -1), 'after'), strings.when.undoMove),
          ),
      );
    }
    if (grouped) {
      list.addSeparator();
      list.addItem((item) =>
        item
          .setTitle(strings.when.ungroup)
          .setIcon('ungroup')
          .setDisabled(filter.negated === true)
          .onClick(() => onEdit(ungroupAt(tree, row.path), strings.when.undoUngroup)),
      );
      if (row.depth + 2 < MAX_DEPTH) {
        list.addItem((item) =>
          item
            .setTitle(strings.when.addGroup)
            .setIcon('folder-plus')
            .onClick(() => onEdit(appendTo(tree, row.path, newGroup()), strings.when.undoAdd)),
        );
      }
    }
    if (filter.negated) {
      list.addItem((item) =>
        item
          .setTitle(strings.when.removeNegation)
          .onClick(() => onEdit(setNegated(tree, row.path, false))),
      );
    }
    list.addSeparator();
    list.addItem((item) =>
      item
        .setTitle(grouped ? strings.when.removeGroup : strings.when.remove)
        .setIcon('trash-2')
        .onClick(() => onEdit(removeAt(tree, row.path), strings.when.undoDelete)),
    );
    const rect = anchor.getBoundingClientRect();
    list.showAtPosition({ x: rect.left, y: rect.bottom }, anchor.ownerDocument);
  };

  return (
    <>
      <Join row={row} tree={tree} onEdit={onEdit} />
      <div
        ref={setElement}
        class={`tr-filter${grouped ? ' tr-filter-group' : ''}${isDragging ? ' tr-dragging' : ''}`}
        data-selected={selectedHere ? 'true' : undefined}
      >
        <div
          ref={setTarget}
          class="tr-when-row"
          data-depth={row.depth}
          data-drop-target={isDropTarget && !isDragging ? 'true' : undefined}
          data-drop-kind={
            grouped
              ? 'inside'
              : dragSource !== null && after(dragSource, row.path)
                ? 'after'
                : 'before'
          }
        >
          <div class="tr-row-handle">
            <button
              ref={handle}
              type="button"
              class="clickable-icon tr-when-action tr-grip"
              aria-label={strings.when.move}
              title={strings.when.move}
            >
              <Icon name="grip-vertical" />
            </button>
            {selecting ? (
              <input
                type="checkbox"
                aria-label={strings.when.selectRow}
                checked={selectedHere}
                onChange={(event) => onSelect(row.path, event.currentTarget.checked)}
              />
            ) : null}
          </div>
          <div
            class={grouped ? 'tr-group-heading' : 'tr-condition-fields'}
            data-field={grouped ? undefined : filter.field}
          >
            {filter.negated ? (
              <span class="tr-legacy-negation">
                {grouped ? strings.when.legacyNegatedGroup : strings.when.legacyNegatedCondition}
              </span>
            ) : null}
            {grouped ? (
              <span class="tr-group-label">{strings.when.group}</span>
            ) : (
              <TestRow row={row} test={filter} viewType={viewType} tree={tree} onEdit={onEdit} />
            )}
          </div>
          <button
            type="button"
            class="clickable-icon tr-when-action tr-row-menu"
            aria-label={strings.when.rowMenu}
            title={strings.when.rowMenu}
            onClick={menu}
          >
            <Icon name="ellipsis" />
          </button>
        </div>
        {grouped ? (
          <div class="tr-group-children">
            {children}
            {filter.children.length === 0 ? (
              <p class="tr-when-empty">{strings.when.emptyGroup}</p>
            ) : null}
            <div class="tr-when-add">
              <button
                type="button"
                onClick={() =>
                  onEdit(
                    appendTo(tree, row.path, newTest(nextField(filter, viewType))),
                    strings.when.undoAdd,
                  )
                }
              >
                {strings.when.addHere}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function drawnSiblings(tree: Group, path: Path): number {
  return rows(tree).filter((row) => key(row.path.slice(0, -1)) === key(path.slice(0, -1))).length;
}

function Join({ row, tree, onEdit }: Omit<RowProps, 'viewType'>): VNode | null {
  if (row.first) return null;
  return (
    <select
      class="dropdown tr-join"
      aria-label={strings.when.join}
      value={row.conjunction}
      onChange={(event) => onEdit(setConjunction(tree, row.path, value(event) as Conjunction))}
    >
      {CONJUNCTIONS.map((conjunction) => (
        <option key={conjunction} value={conjunction}>
          {strings.joins[conjunction]}
        </option>
      ))}
    </select>
  );
}

function TestRow({ row, test, viewType, tree, onEdit }: RowProps & { readonly test: Test }): VNode {
  const spec = fieldSpec(test.field);
  const fieldId = useId();
  const keyErrorId = `${fieldId}-key-error`;
  const valueErrorId = `${fieldId}-value-error`;
  const [keyTouched, setKeyTouched] = useState(false);
  const [valueTouched, setValueTouched] = useState(false);
  const keyMissing = test.field === 'property' && test.key.trim().length === 0;
  const valueMissing = test.value.trim().length === 0;
  const write = (next: Filter): void => onEdit(replaceAt(tree, row.path, next));

  return (
    <>
      <div class="tr-subject">
        <select
          class="dropdown tr-field"
          aria-label={t(spec.label)}
          value={test.field}
          onChange={(event) => write(newTest(value(event) as Field))}
        >
          {offered(viewType).map((entry) => (
            <option key={entry.field} value={entry.field}>
              {t(entry.label)}
            </option>
          ))}
        </select>
        {spec.key ? (
          <div class="tr-input-stack">
            <input
              type="text"
              class="tr-key"
              placeholder={strings.when.property}
              aria-label={strings.when.property}
              aria-invalid={keyTouched && keyMissing}
              aria-describedby={keyTouched && keyMissing ? keyErrorId : undefined}
              onBlur={() => setKeyTouched(true)}
              value={'key' in test ? test.key : ''}
              onInput={(event) => write({ ...test, key: value(event) } as Test)}
            />
            {keyTouched && keyMissing ? (
              <span id={keyErrorId} class="tr-field-error" role="status">
                {strings.when.keyRequired}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div class="tr-comparison">
        <select
          class="dropdown tr-op"
          aria-label={strings.when.operator}
          value={test.op}
          onChange={(event) => write({ ...test, op: value(event), value: '' } as Test)}
        >
          {spec.ops.map((op) => (
            <option key={op} value={op}>
              {t(OPERATOR.get(op)?.label ?? 'ops.is')}
            </option>
          ))}
        </select>
        {OPERATOR.get(test.op)?.value === true ? (
          <div class="tr-input-stack">
            <input
              type="text"
              class="tr-value"
              placeholder={t(spec.hint)}
              aria-label={t(spec.hint)}
              aria-invalid={valueTouched && valueMissing}
              aria-describedby={valueTouched && valueMissing ? valueErrorId : undefined}
              onBlur={() => setValueTouched(true)}
              value={test.value}
              onInput={(event) => write({ ...test, value: value(event) })}
            />
            {valueTouched && valueMissing ? (
              <span id={valueErrorId} class="tr-field-error" role="status">
                {strings.when.valueRequired}
              </span>
            ) : null}
            {looksLikePattern(test.value) ? (
              <div class="tr-regex-hint">{strings.when.regexHint}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* A row is addressed by where it sits, and that is what the drag reports back. */
function key(path: Path): string {
  return path.join('.');
}

/* The root is a group like any other, and it needs a name of its own: an empty
 * one is not an identifier. */
function groupKey(path: Path): string {
  return path.length === 0 ? 'root' : key(path);
}

function pathOf(id: unknown): Path | null {
  if (typeof id !== 'string') return null;
  const text = id;
  if (text.length === 0) return [];

  const parts = text.split('.');
  return parts.every((part) => /^\d+$/.test(part)) ? parts.map(Number) : null;
}

/* Dragged downwards, a row lands after what it was dropped on; upwards, before. */
function after(from: Path, to: Path): boolean {
  for (let at = 0; at < Math.max(from.length, to.length); at += 1) {
    const here = from[at] ?? -1;
    const there = to[at] ?? -1;
    if (here !== there) return here < there;
  }
  return false;
}

function value(event: Event): string {
  return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
}

/* The fields this view can ever produce: a row that could never hold is not
 * offered where it cannot. */
function offered(viewType: string): typeof FIELDS {
  return FIELDS.filter((spec) => spec.views === undefined || spec.views.includes(viewType));
}

/**
 * The field a new row starts on: the one the row above it uses.
 *
 * Writing four conditions about properties should not mean choosing "property"
 * four times.
 */
function nextField(group: Group, viewType: string): Field {
  const last = group.children[group.children.length - 1];
  if (last === undefined || isGroup(last)) return offered(viewType)[0]?.field ?? 'path';
  return offered(viewType).some((spec) => spec.field === last.field) ? last.field : 'path';
}

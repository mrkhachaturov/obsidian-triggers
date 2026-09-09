/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

import { forms } from '../forms.ts';
import type { STRINGS_EN } from './en';

/**
 * Russian strings. Typed against English, so a missing key is a build error.
 *
 * Product names stay as they are: Obsidian, QuickAdd, Bases.
 */
export const STRINGS_RU: typeof STRINGS_EN = {
  views: {
    heading: 'Представления', // Heading above the list of views (English: Views)
    empty: 'Представлений пока нет.', // Shown when no view has rules (English: No views yet.)
    add: 'Добавить представление', // Button that starts rules for another view type (English: Add view)
    ruleCount: forms({ one: 'правило', few: 'правила', many: 'правил', other: 'правила' }), // Counted noun for what a view holds (English: 1 rule / 2 rules)
    allAdded: 'Правила уже есть для всех типов представлений', // Notice when there is nothing left to add (English: Every view type already has rules)
    delete: 'Удалить представление', // Row that deletes the open view (English: Delete view)
    deleteDesc: 'Правила внутри будут удалены.', // Warns that the contents go too (English: Deletes the rules inside it.)
  },

  rules: {
    heading: 'Правила', // Heading above the list of rules (English: Rules)
    empty: 'Правил пока нет.', // Shown when no rule exists (English: No rules yet.)
    newRule: 'Новое правило', // Button that creates a rule (English: New rule)
    edit: 'Порядок и удаление правил', // Button that opens the reordering dialog (English: Edit rules)
  },

  rule: {
    disabled: 'Выключено',
    name: 'Название', // Text field holding the rule's name (English: Name)
    enabled: 'Включено', // Toggle that stops a rule running without deleting it (English: Enabled)
    enabledDesc: 'Выключенное правило сохраняется, но не выполняется.', // Explains the toggle (English: Disabled rules are kept but never run.)
    stop: 'Остановить дальнейшую обработку правил', // Toggle that ends the walk after this rule (English: Stop processing more rules)
    stopDesc: 'После срабатывания следующие правила не проверяются.', // Explains the toggle (English: Rules after this one are not checked once it fires.)
    delete: 'Удалить правило', // Row that deletes the open rule (English: Delete rule)
    runsNothing: 'Действия не добавлены', // Shown on a rule's row when it has no actions (English: Nothing)
  },

  when: {
    count: forms({ one: 'условие', few: 'условия', many: 'условий', other: 'условия' }),
    valueRequired: 'Укажите значение.',
    keyRequired: 'Укажите имя свойства.',
    moveOut: 'Вынести из группы',
    moveDown: 'Переместить ниже',
    moveUp: 'Переместить выше',
    removeNegation: 'Убрать сохранённое исключение',
    legacyNegatedCondition: 'Сохранённое исключение: результат этого условия перевёрнут.',
    legacyNegatedGroup: 'Сохранённое исключение: срабатывает, когда условия ниже не выполнены.',
    removeGroup: 'Удалить группу с условиями',
    rowMenu: 'Действия с условием',
    undoAdd: 'Отменить добавление',
    undoUngroup: 'Отменить разгруппировку',
    undoGroup: 'Отменить группировку',
    undoMove: 'Отменить перемещение',
    undoDelete: 'Восстановить удалённые условия',
    incomplete: 'Есть незаполненные условия',
    allView: 'Без ограничений для этого представления',
    allMarkdown: 'Все Markdown-файлы',
    emptyHint: 'Добавьте условия, чтобы ограничить применение правила.',
    helpTitle: 'Примеры и справка',
    expression: 'Как применяются условия',
    selectRows: 'Объединить условия в группу',
    cancelSelection: 'Отменить выбор',
    groupSelected: 'Объединить выбранное',
    undo: 'Отменить правку поля',
    selectionHint: 'Выберите соседние условия или группы и нажмите «Объединить выбранное».',
    selectRow: 'Выбрать условие или группу',
    ungroup: 'Разгруппировать',
    emptyGroup: 'Добавьте условие, чтобы завершить настройку группы.',
    emptyNegated: 'Это сохранённое правило исключает все файлы.',
    heading: 'Условия', // Heading above the conditions (English: Conditions)
    add: 'Добавить условие', // Button that appends a condition (English: Add condition)
    addGroup: 'Добавить вложенную группу',
    group: 'Группа', // Label on the row standing for a nested group (English: Group)
    addHere: 'Добавить условие',
    join: 'Как эта строка соединяется с предыдущей', // Label of the control joining a row to the one above it, for a screen reader (English: How this row joins the one above it)
    operator: 'Как сравнивается значение', // Label of the operator control, for a screen reader (English: How the value is compared)
    move: 'Переместить условие', // Label of the drag handle, which is also the keyboard control (English: Move this condition)
    remove: 'Удалить условие',
    property: 'Имя свойства',
    pathHint: 'Введите значение',
    viewNameHint: 'Введите название представления',
    valueHint: 'Введите значение',
    helpExamples: {
      folder: { title: 'Файлы из папки', setup: 'Выберите «Путь» → «в папке» и введите Projects.' },
      suffix: {
        title: 'Файлы с определённым окончанием',
        setup: 'Выберите «Путь» → «заканчивается на» и введите .draft.md.',
      },
      status: {
        title: 'Заметки со статусом open',
        setup: 'Выберите «Свойство», укажите status, затем «соответствует» и значение open.',
      },
      missing: {
        title: 'Заметки без свойства due',
        setup: 'Выберите «Свойство», укажите due и выберите «отсутствует». Значение не требуется.',
      },
    },
    helpMultiple:
      'Соедините два условия через «и», если должны выполняться оба, или через «или», если достаточно одного.',
    regexTitle: 'Регулярные выражения',
    helpRegex:
      'Для поиска по шаблону введите регулярное выражение между символами / в поле значения.',
    regexExample: '/отчёт-\\d{4}/',
    regexExplanation: 'Например, этот шаблон найдёт «отчёт-2026» в пути файла.',
    regexHint: 'Похоже на регулярное выражение — оберните в /слэши/, чтобы оно так и читалось.', // Hint under a value that forgot its slashes (English: This looks like a regular expression — wrap it in /slashes/ to use it as one.)
  },

  /* The word between two rows, which is also the control that sets it. */
  joins: {
    where: '', // Prefix on the first row of a group (English: where)
    and: 'и', // Connective: every row must hold (English: and)
    or: 'или', // Connective: one row is enough (English: or)
    not: 'не', // Connective: no row may hold (English: nor)
  },

  fields: {
    path: 'Путь', // The file in view, by its vault path (English: Path)
    viewName: 'Вид базы', // The view a Base is currently showing (English: Base view)
    property: 'Свойство', // A frontmatter property of the note in view (English: Property)
  },

  ops: {
    is: 'соответствует', // Operator: exactly this value (English: is)
    contains: 'содержит', // Operator: this value appears inside (English: contains)
    notContains: 'не содержит', // Operator: this value does not appear inside (English: does not contain)
    startsWith: 'начинается с', // Operator: the value begins with this (English: starts with)
    endsWith: 'заканчивается на', // Operator: the value ends with this (English: ends with)
    inFolder: 'в папке', // Operator: the file sits under this folder (English: in folder)
    notInFolder: 'не в папке', // Operator: the file does not sit under this folder (English: not in folder)
    exists: 'есть', // Operator: the property is present (English: exists)
    missing: 'отсутствует', // Operator: the property is not present (English: is missing)
    empty: 'пусто', // Operator: the property is present and holds nothing (English: is empty)
  },

  match: {
    badPattern: 'Некорректное регулярное выражение:', // Reported once when a pattern cannot be built (English: Invalid regular expression:)
  },

  actions: {
    add: 'Добавить действие',
    heading: 'Действия', // Heading above what a rule runs (English: Actions)
    empty: 'Действия не добавлены.', // Shown when a rule runs nothing (English: No actions yet.)
    addCommand: 'Добавить команду', // Button that adds an Obsidian command (English: Add command)
    addChoice: 'Добавить choice из QuickAdd', // Button that adds a QuickAdd choice (English: Add QuickAdd choice)
    edit: 'Порядок и удаление действий', // Button that opens the reordering dialog (English: Edit actions)
    command: 'Команда Obsidian', // Row title for a command action (English: Obsidian command)
    choice: 'Choice из QuickAdd', // Row title for a QuickAdd action (English: QuickAdd choice)
    change: 'Изменить', // Button that picks a different target (English: Change)
    notSet: 'Не задано', // Shown when an action has no target yet (English: Not set)
    count: forms({ one: 'действие', few: 'действия', many: 'действий', other: 'действия' }), // Counted noun for what a rule runs (English: 1 action / 2 actions)
    run: 'Выполнить правило сейчас', // Row that runs the open rule against the current context (English: Run this rule now)
    runDesc: 'Выполняет здесь, если условия совпадут.', // Explains the row (English: Runs it here, if its conditions hold.)
    ran: 'Правило выполнено', // Notice after a rule was run by hand (English: Rule ran)
    didNotMatch: 'Здесь ничего не совпало', // Notice when the rule did not hold in this context (English: Nothing matched here)
    nowhere: 'Ничего не открыто', // Notice when there is no context to run against (English: Nothing is open)
  },

  pickers: {
    command: 'Выберите команду', // Placeholder in the command picker (English: Choose a command to run)
    choice: 'Выберите choice из QuickAdd', // Placeholder in the QuickAdd picker (English: Choose a QuickAdd choice)
    viewType: 'Выберите представление для правил', // Placeholder in the view type picker (English: Choose a view to write rules for)
    navigate: 'перемещение', // Keyboard hint for the arrow keys (English: to navigate)
    choose: 'выбрать', // Keyboard hint for the enter key (English: to choose)
    cancel: 'отмена', // Keyboard hint for the escape key (English: to cancel)
  },

  naming: {
    newRule: 'Новое правило', // Title of the dialog that names a new rule (English: New rule)
    name: 'Название', // Text field in the naming dialog (English: Name)
    create: 'Создать', // Button that confirms the name (English: Create)
  },

  manage: {
    moveUp: 'Выше', // Tooltip on the button that moves a row up (English: Move up)
    moveDown: 'Ниже', // Tooltip on the button that moves a row down (English: Move down)
    delete: 'Удалить', // Tooltip on the button that removes a row (English: Delete)
  },

  diagnostics: {
    heading: 'Диагностика', // Heading above the log (English: Diagnostics)
    log: 'Журнал', // Page holding recent activity (English: Log)
    logDesc: 'Последние срабатывания правил.', // Description under the log's row (English: Recent rule activity.)
    entries: forms({ one: 'запись', few: 'записи', many: 'записей', other: 'записи' }), // Counted noun for log entries (English: 1 entry / 2 entries)
    recording: 'Отладочный журнал', // Toggle that records what the plugin decided (English: Debug logging)
    recordingDesc:
      'Записывать, какие правила совпали при каждом переходе. Хранится только на этом устройстве. Ошибки записываются всегда.', // Explains the toggle (English: Record which rules matched on every navigation. Stored on this device only. Failures are always recorded.)
    recent: 'Последние события', // Heading above the log entries (English: Recent activity)
    empty: 'Событий пока нет.', // Shown when the log is empty (English: No activity recorded.)
    clear: 'Очистить журнал', // Row that empties the log (English: Clear log)
    nothingOpen: 'ничего не открыто', // Log text when no file was open (English: nothing open)
    noMatch: 'ни одно правило не совпало', // Log text when nothing matched (English: no rule matched)
    considered: 'проверено', // Log text after the number of rules examined (English: considered)
    noActions: 'без действий', // Log text when a matching rule had nothing to run (English: no actions)
  },

  library: {
    heading: 'Импорт и экспорт', // Heading above the transfer rows (English: Import and export)
    export: 'Экспорт', // Row that copies rules to the clipboard (English: Export)
    exportDesc: 'Файлом или в буфер обмена.', // Explains the row (English: As a file, or on the clipboard.)
    import: 'Импорт', // Row that reads rules from the clipboard (English: Import)
    importDesc: 'Из файла или вставкой.', // Explains the row (English: From a file, or pasted in.)
    copied: 'Скопировано в буфер обмена', // Notice after a successful export (English: Copied to clipboard)
    exportTitle: 'Экспорт правил', // Title of the export dialog (English: Export rules)
    importTitle: 'Импорт правил', // Title of the import dialog (English: Import rules)
    copy: 'Скопировать', // Button that puts the package on the clipboard (English: Copy)
    save: 'Сохранить файл', // Button that downloads the package (English: Save file)
    chooseFile: 'Выбрать файл', // Button that opens the file picker (English: Choose file)
    paste: 'Вставьте сюда файл с правилами', // Placeholder in the import box (English: Paste a rules file here)
    conflict: 'Правила, которые уже есть', // Dropdown deciding what happens to entries the vault holds (English: Rules already here)
    conflictDesc: 'Новые правила добавляются всегда. Это про те, что уже есть в этом вейле.', // Explains the dropdown (English: New rules are always added. This is for the ones already in this vault.)
    replace: 'Заменить', // Dropdown option that overwrites the stored rule (English: Replace)
    merge: 'Добавить их правила', // Dropdown option that keeps both sets of rules (English: Add their rules)
    skip: 'Пропустить', // Dropdown option that leaves the stored rule alone (English: Skip)
    found: 'в файле: {count}', // Says how many rules the file carries (English: {count} in the file)
    alreadyHere: 'уже есть: {count}', // Says how many of them the vault holds (English: {count} already here)
    dropped: 'нечитаемых: {count}', // Says how many entries had to be dropped (English: {count} unreadable)
    newer: 'Файл записан более новой версией плагина.', // Refuses a package it cannot read (English: This file was written by a newer version of the plugin.)
    added: 'Добавлено: {count}', // Reports how many rules arrived (English: Added {count})
    replaced: 'заменено: {count}', // Reports how many were overwritten (English: replaced {count})
    mergedCount: 'дополнено: {count}', // Reports how many views received the incoming rules (English: added to {count})
    skippedCount: 'пропущено: {count}', // Reports how many were left alone (English: skipped {count})
    notRules: 'В буфере обмена нет правил', // Notice when the clipboard holds something else (English: The clipboard does not contain rules)
    noneReadable: 'Не найдено ни одного читаемого правила', // Notice when nothing in the package could be read (English: No readable rules found)
  },

  commands: {
    runHere: 'Выполнить правила для текущего контекста', // Command that walks the rules on demand (English: Run rules for the current context)
  },

  island: {
    failed: 'не удалось показать. Остальные настройки работают.', // Shown in place of a part of the screen that failed to draw (English: could not be shown. The rest of the settings still work.)
  },

  store: {
    unreadable:
      'Не удалось прочитать data.json. Правила не будут сохраняться, пока файл не исправлен.', // Shown when the data file cannot be understood (English: Could not read data.json. Rules will not be saved until it is fixed.)
    skippedOne: 'Пропущена 1 нечитаемая запись', // Shown when one stored entry was dropped (English: Skipped 1 unreadable entry)
    skippedMany: 'Пропущено нечитаемых записей: {count}', // Shown when several stored entries were dropped (English: Skipped {count} unreadable entries)
    saveFailed: 'Не удалось сохранить правила', // Shown when writing the data file fails (English: Could not save rules)
  },

  runner: {
    noHandler: 'выполнить нечем', // Log text when no handler owns an action's kind (English: nothing can run it)
    ran: 'выполнено', // Log prefix for an action that was dispatched (English: ran)
    skippedAction: 'пропущено', // Log prefix for an action that was not dispatched (English: skipped)
    failed: 'ошибка', // Log prefix for an action that threw (English: failed)
    noCommand: 'нет команды', // Reported when a command id no longer exists (English: no command)
    declined: 'команда отказалась выполняться', // Reported when Obsidian refused to run a command (English: declined to run)
    quickAddMissing: 'QuickAdd недоступен', // Reported when QuickAdd is not installed (English: QuickAdd is not available)
    noChoice: 'нет choice', // Reported when a QuickAdd choice no longer exists (English: no choice)
  },

  condition: {
    anything: 'Что угодно', // Shown on a rule's row when it matches every context (English: Anything)
    any: 'ничего не совпало', // Log text when the conditions refused as a whole (English: nothing matched)
  },
};

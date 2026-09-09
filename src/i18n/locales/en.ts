/*
 * Triggers - Plugin for Obsidian
 * Copyright (c) 2026 Ruben Khachaturov
 * SPDX-License-Identifier: MIT
 */

/**
 * English strings, and the shape every other locale is checked against.
 *
 * Each entry carries what it is for and its English text, so a translator reads
 * the original next to the translation without leaving the file.
 *
 * Product names are never translated: Obsidian, QuickAdd, Bases.
 */
import { forms } from '../forms.ts';

export const STRINGS_EN = {
  views: {
    heading: 'Views', // Heading above the list of views (English: Views)
    empty: 'No views yet.', // Shown when no view has rules (English: No views yet.)
    add: 'Add view', // Button that starts rules for another view type (English: Add view)
    ruleCount: forms({ one: 'rule', other: 'rules' }), // Counted noun for what a view holds (English: 1 rule / 2 rules)
    allAdded: 'Every view type already has rules', // Notice when there is nothing left to add (English: Every view type already has rules)
    delete: 'Delete view', // Row that deletes the open view (English: Delete view)
    deleteDesc: 'Deletes the rules inside it.', // Warns that the contents go too (English: Deletes the rules inside it.)
  },

  rules: {
    heading: 'Rules', // Heading above the list of rules (English: Rules)
    empty: 'No rules yet.', // Shown when no rule exists (English: No rules yet.)
    newRule: 'New rule', // Button that creates a rule (English: New rule)
    edit: 'Reorder or remove rules', // Button that opens the reordering dialog (English: Edit rules)
  },

  rule: {
    disabled: 'Disabled',
    name: 'Name', // Text field holding the rule's name (English: Name)
    enabled: 'Enabled', // Toggle that stops a rule running without deleting it (English: Enabled)
    enabledDesc: 'Disabled rules are kept but never run.', // Explains the toggle (English: Disabled rules are kept but never run.)
    stop: 'Stop processing more rules', // Toggle that ends the walk after this rule (English: Stop processing more rules)
    stopDesc: 'Rules after this one are not checked once it fires.', // Explains the toggle (English: Rules after this one are not checked once it fires.)
    delete: 'Delete rule', // Row that deletes the open rule (English: Delete rule)
    runsNothing: 'Actions not added', // Shown on a rule's row when it has no actions (English: Nothing)
  },

  when: {
    count: forms({ one: 'condition', other: 'conditions' }),
    valueRequired: 'Enter a value.',
    keyRequired: 'Enter a property name.',
    moveOut: 'Move out of group',
    moveDown: 'Move down',
    moveUp: 'Move up',
    removeNegation: 'Remove saved exclusion',
    legacyNegatedCondition: 'Saved exclusion: the result of this condition is reversed.',
    legacyNegatedGroup: 'Saved exclusion: matches when the conditions below do not match.',
    removeGroup: 'Delete group and its conditions',
    rowMenu: 'Condition actions',
    undoAdd: 'Undo addition',
    undoUngroup: 'Undo ungrouping',
    undoGroup: 'Undo grouping',
    undoMove: 'Undo move',
    undoDelete: 'Restore deleted conditions',
    incomplete: 'Conditions are not fully configured',
    allView: 'No restrictions for this view',
    allMarkdown: 'All Markdown files',
    emptyHint: 'Add conditions to limit where this rule applies.',
    helpTitle: 'Examples and matching help',
    expression: 'How conditions are applied',
    selectRows: 'Group conditions',
    cancelSelection: 'Cancel selection',
    groupSelected: 'Group selected',
    undo: 'Undo last field edit',
    selectionHint: 'Select adjacent conditions or groups, then choose Group selected.',
    selectRow: 'Select this condition or group',
    ungroup: 'Ungroup',
    emptyGroup: 'Add a condition to finish configuring this group.',
    emptyNegated: 'This saved rule excludes all files.',
    heading: 'Conditions', // Heading above the conditions (English: Conditions)
    add: 'Add condition', // Button that appends a condition (English: Add condition)
    addGroup: 'Add subgroup',
    group: 'Group', // Label on the row standing for a nested group (English: Group)
    addHere: 'Add condition',
    join: 'How this row joins the one above it', // Label of the control joining a row to the one above it, for a screen reader (English: How this row joins the one above it)
    operator: 'How the value is compared', // Label of the operator control, for a screen reader (English: How the value is compared)
    move: 'Move this condition', // Label of the drag handle, which is also the keyboard control (English: Move this condition)
    remove: 'Delete condition',
    property: 'Property name',
    pathHint: 'Enter a value',
    viewNameHint: 'Enter a view name',
    valueHint: 'Enter a value',
    helpExamples: {
      folder: { title: 'Files in a folder', setup: 'Choose Path → in folder and enter Projects.' },
      suffix: {
        title: 'Files with a specific ending',
        setup: 'Choose Path → ends with and enter .draft.md.',
      },
      status: {
        title: 'Notes with status open',
        setup: 'Choose Property, enter status, then choose is and enter open.',
      },
      missing: {
        title: 'Notes without a due property',
        setup: 'Choose Property, enter due, then choose is missing. No value is needed.',
      },
    },
    helpMultiple:
      'Connect two conditions with and when both must match, or with or when either may match.',
    regexTitle: 'Regular expressions',
    helpRegex:
      'For pattern matching, enter a regular expression between / characters in the value field.',
    regexExample: '/report-\\d{4}/',
    regexExplanation: 'For example, this pattern finds “report-2026” in a file path.',
    regexHint: 'This looks like a regular expression — wrap it in /slashes/ to use it as one.', // Hint under a value that forgot its slashes (English: This looks like a regular expression — wrap it in /slashes/ to use it as one.)
  },

  /* The word between two rows, which is also the control that sets it. */
  joins: {
    where: 'where', // Prefix on the first row of a group (English: where)
    and: 'and', // Connective: every row must hold (English: and)
    or: 'or', // Connective: one row is enough (English: or)
    not: 'not', // Connective: no row may hold (English: nor)
  },

  fields: {
    path: 'Path', // The file in view, by its vault path (English: Path)
    viewName: 'Base view', // The view a Base is currently showing (English: Base view)
    property: 'Property', // A frontmatter property of the note in view (English: Property)
  },

  ops: {
    is: 'is', // Operator: exactly this value (English: is)
    contains: 'contains', // Operator: this value appears inside (English: contains)
    notContains: 'does not contain', // Operator: this value does not appear inside (English: does not contain)
    startsWith: 'starts with', // Operator: the value begins with this (English: starts with)
    endsWith: 'ends with', // Operator: the value ends with this (English: ends with)
    inFolder: 'in folder', // Operator: the file sits under this folder (English: in folder)
    notInFolder: 'not in folder', // Operator: the file does not sit under this folder (English: not in folder)
    exists: 'exists', // Operator: the property is present (English: exists)
    missing: 'is missing', // Operator: the property is not present (English: is missing)
    empty: 'is empty', // Operator: the property is present and holds nothing (English: is empty)
  },

  match: {
    badPattern: 'Invalid regular expression:', // Reported once when a pattern cannot be built (English: Invalid regular expression:)
  },

  actions: {
    add: 'Add action',
    heading: 'Actions', // Heading above what a rule runs (English: Actions)
    empty: 'Actions not added.', // Shown when a rule runs nothing (English: No actions yet.)
    addCommand: 'Add command', // Button that adds an Obsidian command (English: Add command)
    addChoice: 'Add QuickAdd choice', // Button that adds a QuickAdd choice (English: Add QuickAdd choice)
    edit: 'Reorder or remove actions', // Button that opens the reordering dialog (English: Edit actions)
    command: 'Obsidian command', // Row title for a command action (English: Obsidian command)
    choice: 'QuickAdd choice', // Row title for a QuickAdd action (English: QuickAdd choice)
    change: 'Change', // Button that picks a different target (English: Change)
    notSet: 'Not set', // Shown when an action has no target yet (English: Not set)
    count: forms({ one: 'action', other: 'actions' }), // Counted noun for what a rule runs (English: 1 action / 2 actions)
    run: 'Run this rule now', // Row that runs the open rule against the current context (English: Run this rule now)
    runDesc: 'Runs it here, if its conditions hold.', // Explains the row (English: Runs it here, if its conditions hold.)
    ran: 'Rule ran', // Notice after a rule was run by hand (English: Rule ran)
    didNotMatch: 'Nothing matched here', // Notice when the rule did not hold in this context (English: Nothing matched here)
    nowhere: 'Nothing is open', // Notice when there is no context to run against (English: Nothing is open)
  },

  pickers: {
    command: 'Choose a command to run', // Placeholder in the command picker (English: Choose a command to run)
    choice: 'Choose a QuickAdd choice', // Placeholder in the QuickAdd picker (English: Choose a QuickAdd choice)
    viewType: 'Choose a view to write rules for', // Placeholder in the view type picker (English: Choose a view to write rules for)
    navigate: 'to navigate', // Keyboard hint for the arrow keys (English: to navigate)
    choose: 'to choose', // Keyboard hint for the enter key (English: to choose)
    cancel: 'to cancel', // Keyboard hint for the escape key (English: to cancel)
  },

  naming: {
    newRule: 'New rule', // Title of the dialog that names a new rule (English: New rule)
    name: 'Name', // Text field in the naming dialog (English: Name)
    create: 'Create', // Button that confirms the name (English: Create)
  },

  manage: {
    moveUp: 'Move up', // Tooltip on the button that moves a row up (English: Move up)
    moveDown: 'Move down', // Tooltip on the button that moves a row down (English: Move down)
    delete: 'Delete', // Tooltip on the button that removes a row (English: Delete)
  },

  diagnostics: {
    heading: 'Diagnostics', // Heading above the log (English: Diagnostics)
    log: 'Log', // Page holding recent activity (English: Log)
    logDesc: 'Recent rule activity.', // Description under the log's row (English: Recent rule activity.)
    entries: forms({ one: 'entry', other: 'entries' }), // Counted noun for log entries (English: 1 entry / 2 entries)
    recording: 'Debug logging', // Toggle that records what the plugin decided (English: Debug logging)
    recordingDesc:
      'Record which rules matched on every navigation. Stored on this device only. Failures are always recorded.', // Explains the toggle (English: Record which rules matched on every navigation. Stored on this device only. Failures are always recorded.)
    recent: 'Recent activity', // Heading above the log entries (English: Recent activity)
    empty: 'No activity recorded.', // Shown when the log is empty (English: No activity recorded.)
    clear: 'Clear log', // Row that empties the log (English: Clear log)
    nothingOpen: 'nothing open', // Log text when no file was open (English: nothing open)
    noMatch: 'no rule matched', // Log text when nothing matched (English: no rule matched)
    considered: 'considered', // Log text after the number of rules examined (English: considered)
    noActions: 'no actions', // Log text when a matching rule had nothing to run (English: no actions)
  },

  library: {
    heading: 'Import and export', // Heading above the transfer rows (English: Import and export)
    export: 'Export', // Row that copies rules to the clipboard (English: Export)
    exportDesc: 'As a file, or on the clipboard.', // Explains the row (English: As a file, or on the clipboard.)
    import: 'Import', // Row that reads rules from the clipboard (English: Import)
    importDesc: 'From a file, or pasted in.', // Explains the row (English: From a file, or pasted in.)
    copied: 'Copied to clipboard', // Notice after a successful export (English: Copied to clipboard)
    exportTitle: 'Export rules', // Title of the export dialog (English: Export rules)
    importTitle: 'Import rules', // Title of the import dialog (English: Import rules)
    copy: 'Copy', // Button that puts the package on the clipboard (English: Copy)
    save: 'Save file', // Button that downloads the package (English: Save file)
    chooseFile: 'Choose file', // Button that opens the file picker (English: Choose file)
    paste: 'Paste a rules file here', // Placeholder in the import box (English: Paste a rules file here)
    conflict: 'Rules already here', // Dropdown deciding what happens to entries the vault holds (English: Rules already here)
    conflictDesc: 'New rules are always added. This is for the ones already in this vault.', // Explains the dropdown (English: New rules are always added. This is for the ones already in this vault.)
    replace: 'Replace', // Dropdown option that overwrites the stored rule (English: Replace)
    merge: 'Add their rules', // Dropdown option that keeps both sets of rules (English: Add their rules)
    skip: 'Skip', // Dropdown option that leaves the stored rule alone (English: Skip)
    found: '{count} in the file', // Says how many rules the file carries (English: {count} in the file)
    alreadyHere: '{count} already here', // Says how many of them the vault holds (English: {count} already here)
    dropped: '{count} unreadable', // Says how many entries had to be dropped (English: {count} unreadable)
    newer: 'This file was written by a newer version of the plugin.', // Refuses a package it cannot read (English: This file was written by a newer version of the plugin.)
    added: 'Added {count}', // Reports how many rules arrived (English: Added {count})
    replaced: 'replaced {count}', // Reports how many were overwritten (English: replaced {count})
    mergedCount: 'added to {count}', // Reports how many views received the incoming rules (English: added to {count})
    skippedCount: 'skipped {count}', // Reports how many were left alone (English: skipped {count})
    notRules: 'The clipboard does not contain rules', // Notice when the clipboard holds something else (English: The clipboard does not contain rules)
    noneReadable: 'No readable rules found', // Notice when nothing in the package could be read (English: No readable rules found)
  },

  commands: {
    runHere: 'Run rules for the current context', // Command that walks the rules on demand (English: Run rules for the current context)
  },

  island: {
    failed: 'could not be shown. The rest of the settings still work.', // Shown in place of a part of the screen that failed to draw (English: could not be shown. The rest of the settings still work.)
  },

  store: {
    unreadable: 'Could not read data.json. Rules will not be saved until it is fixed.', // Shown when the data file cannot be understood (English: Could not read data.json. Rules will not be saved until it is fixed.)
    skippedOne: 'Skipped 1 unreadable entry', // Shown when one stored entry was dropped (English: Skipped 1 unreadable entry)
    skippedMany: 'Skipped {count} unreadable entries', // Shown when several stored entries were dropped (English: Skipped {count} unreadable entries)
    saveFailed: 'Could not save rules', // Shown when writing the data file fails (English: Could not save rules)
  },

  runner: {
    noHandler: 'nothing can run it', // Log text when no handler owns an action's kind (English: nothing can run it)
    ran: 'ran', // Log prefix for an action that was dispatched (English: ran)
    skippedAction: 'skipped', // Log prefix for an action that was not dispatched (English: skipped)
    failed: 'failed', // Log prefix for an action that threw (English: failed)
    noCommand: 'no command', // Reported when a command id no longer exists (English: no command)
    declined: 'declined to run', // Reported when Obsidian refused to run a command (English: declined to run)
    quickAddMissing: 'QuickAdd is not available', // Reported when QuickAdd is not installed (English: QuickAdd is not available)
    noChoice: 'no choice', // Reported when a QuickAdd choice no longer exists (English: no choice)
  },

  condition: {
    anything: 'Anything', // Shown on a rule's row when it matches every context (English: Anything)
    any: 'nothing matched', // Log text when the conditions refused as a whole (English: nothing matched)
  },
};

# Reference

What a rule can match on, and what it hands to QuickAdd. The tables below are generated from the
same lists the plugin reads, so a control that exists on screen is a row here and nothing else is.

Prose belongs in `docs/templates/reference.md`; the tables are filled in at build time.

## Conditions

A rule is a tree of rows. Each row is a field, an operator and a value; the word between two rows —
**and**, **or**, **nor** — says how they are read, and a row can be a group holding rows of its own.
An empty rule matches every context, and nesting stops at five levels.

A field only appears on a rule written for a view that can produce it — a Base's view name is not
offered to a markdown rule, because nothing there could ever set it.

{{FIELDS}}

{{OPERATORS}}

**`is missing` and `is empty` are different questions.** A property that is not there is not an
empty one: `is empty` on an absent property does not hold, and absence is `is missing`.

**An empty value is a convention, not an oversight.** The positive forms never hold with nothing to
compare against, and the negative forms always do.

### Regular expressions

Wrap a value in slashes — `/\d{4}-\d{2}-\d{2}/`, `/report/i` — and **is**, **contains** and
**does not contain** test it as an expression instead of as text. That is the convention Obsidian's
own Web Clipper uses for URL triggers.

`is` and `contains` behave identically here: both ask whether the pattern appears anywhere. Anchor
it with `^…$` for a whole-value match. Matching is case-sensitive unless you add `i`, and the `g`
and `y` flags are ignored. A pattern that cannot be built never matches and is reported once.

### What is compared

Before a literal comparison, both sides are reduced to the same shape: `[[wikilinks]]` become their
text, surrounding quotes are dropped, whitespace is trimmed, case is ignored, and a leading `#` is
dropped so `#task` and `task` are one thing. A value matches its own children, so `project` matches
`project/active`.

A property registered as a checkbox, a date or a datetime is compared as that type, so `08-09-2026`
holds against a date property storing `2026-09-08`. The date formats tried are the vault's own —
Daily Notes first, then Templates — then `DD-MM-YYYY`, `DD/MM/YYYY` and `YYYY/MM/DD`.

## What a QuickAdd action receives

{{VARIABLES}}

Every variable is a string, and an absent value is the empty string rather than a missing key. A
frontmatter property holding a nested map is left out: it is outside Obsidian's own property types,
and `[object Object]` in a template is worse than an absent variable.

A date is stored as text, so comparing with `lessThan` on a string orders `2026-09-06` before
`2026-09-07` and needs no script.

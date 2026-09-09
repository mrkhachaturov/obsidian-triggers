# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The version in the heading, in `manifest.json`, in `versions.json` and on the git tag is one number.
A release copies its section from this file and nothing is retyped: `mise run test:release` refuses a
release where those four disagree.

<!-- How an entry is written:

- Categories are Added, Changed, Deprecated, Removed, Fixed and Security, in that order. A category
  with nothing under it is left out.
- One line per change, saying what changed - not what it is worth. No "powerful", "seamlessly",
  "greatly improved": an adjective a reader cannot check is noise.
- Name things the way the interface names them, so a reader can go and find them.
- A fix says what was wrong. "Fixed a bug" matches nobody's problem.
- Write it for the person installing the update, not for the person who wrote the commit.

## [9.9.9] - 9090-09-09

### Added
### Changed
### Fixed

-->

## Unreleased

## [0.1.1] - 2026-09-09

### Changed

- The plugin's own description, and a stylesheet check that runs the same ruleset the community
  directory scans with, so its warnings are answered before a release rather than after one.
- The trace switch is kept through Obsidian's own device-local storage instead of the browser's.

### Fixed

- A property condition no longer relies on `display: contents`, which the directory reports as only
  partly supported on the engine it lints against.

## [0.1.0] - 2026-09-09

### Added

- Rules that run commands when you open something. Each rule belongs to a view type — Markdown,
  Canvas, Bases, and Excalidraw when that plugin is installed — and runs when every condition you
  switched on matches.
- Conditions on the path, on a folder, on the view shown in the Bases toolbar, and on frontmatter
  properties and tags, with operators for exact, partial, presence and emptiness. A value wrapped in
  slashes is read as a regular expression.
- Properties registered as a checkbox, a date or a datetime are compared as that type, using the
  vault's own date formats before the common ones.
- Actions run in order: any command from the palette, or a QuickAdd choice, which receives where you
  are, which rule fired, and the note's tags and properties as variables it can branch on.
- Rules are grouped per view and can be reordered; several matching rules all run, top to bottom,
  and a rule can stop the walk after it.
- Export and import of rules as a file, with a report of what an import will add, replace or skip
  before it does anything.
- A decision trace, off by default, that records the rule that fired and the rule that matched and
  did nothing.
- A command that runs the rules for what is already open, without navigating away and back.
- Translated interface following the language selected in Obsidian.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
# Contributing

- [Bug reports](#bug-reports)
- [Feature requests](#feature-requests)
- [Pull requests](#pull-requests)
- [Development](#development)
- [Security issues](#security-issues)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

Thanks for wanting to help. The most useful contribution is a bug report from someone whose rule did
not fire, with enough detail to reproduce it.

## Bug reports

Open an issue with the Obsidian version, the plugin version, your operating system, and what you
opened when it went wrong. Turn on the decision trace in the plugin's settings first: it records the
rule that fired and the rule that matched and did nothing, which is the difference between "it is
broken" and "the condition never matched". Paste the trace and the rule itself into the issue.

## Feature requests

Open an issue describing what you want to happen and when. This plugin owns the *when*: it decides
that a context matches and hands the work on. The *what* — branching, templates, scripts, anything
that has to wait for something — belongs to QuickAdd, Templater or Commander, and a rule can run
those. A request that asks this plugin to become a second automation engine will be turned down, and
the issue is still worth opening so the boundary is written down somewhere public.

## Pull requests

Pull requests are welcome. To save us both from wasted work:

- **Claim the issue first.** Comment on it and wait before writing code. A change nobody agreed on
  is the one most likely to be closed.
- **Keep it narrow.** One change per pull request. A refactor bundled with a fix hides the fix.
- **`mise run check` has to pass.** It is the whole set of gates, and the pre-push hook runs it
  anyway. When a gate fails, the fix goes in the thing being measured, not in the measure.
- **Say how you verified it in Obsidian.** Automated tests cannot tell you whether an Obsidian event
  actually fires. Name the version you ran against, describe the rule you used, and attach a
  screenshot for anything visible.
- **A claim about an event is measured, not assumed.** Every claim about Obsidian's events in this
  plugin was wrong the first time it was guessed and right only after it was measured against a live
  vault. Say how you measured it.
- **Conventional commits.** The commit-msg hook enforces them.
- **Do not commit `main.js`.** It is built from `src/` and ignored on purpose; the release workflow
  is what produces the copy people install.
- AI assistance is fine, and unread AI output is not. Read what you send.

## Development

```sh
mise install && mise deps            # tools, then dependencies
mise run dev                         # rebuild on save
VAULT=/path/to/vault mise run plugin:install
```

`plugin:install` builds and copies `main.js`, `manifest.json` and `styles.css` into that vault.
Reload the plugin in Obsidian afterwards, or the previous bundle keeps running.

| Task | What it checks or produces |
| --- | --- |
| `mise run lint` | Formatting and generic lint through flint |
| `mise run lint:code` | Obsidian rules and type-aware ESLint |
| `mise run lint:docs` | The tables of contents are current |
| `mise run test:types` | TypeScript for source and test fixtures |
| `mise run test:unit` | Unit and DOM tests |
| `mise run test:coverage` | Tests and coverage for all source modules |
| `mise run test:dead` | Unreachable files, unused exports, unresolved imports |
| `mise run test:docs` | `docs/reference.md` still matches the code |
| `mise run test:release` | The version, the changelog and the release files agree |
| `mise run test:strings` | No translated string is unused or missing |
| `mise run test:styles` | Agreement between plugin CSS classes and source |
| `mise run check` | All gates, including the production build |
| `mise run fmt` | Apply the fixes supported by flint |

`docs/reference.md` is generated — edit `docs/templates/reference.md` and run `mise run docs`.

New code follows what is around it: a capability is a class of its own, algorithms are pure
functions, `data.json` is treated as hostile input, and a comment carries what the code cannot — a
measurement, a constraint, the reason an obvious alternative was rejected.

Releases are cut the way [.github/RELEASING.md](.github/RELEASING.md) describes.

## Security issues

Not here — see [SECURITY.md](SECURITY.md).

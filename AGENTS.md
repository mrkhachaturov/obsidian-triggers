# obsidian-triggers

Runs the user's commands when the context matches. The *what* — branching, templates, scripts,
shareable packages — stays with QuickAdd, Templater and Commander. This plugin owns the *when*, and
nothing here may grow into a second automation engine.

## Done means the gates pass

`mise run check` is the definition of done. Claiming a change works without it is a lie by omission.

- **A rule not enforced by a gate is not a rule.** New discipline goes into biome, eslint, knip, tsc
  or vitest — never into this file as an honour system.
- **Never run a linter or a compiler by hand instead of its task.** The task carries the flags; a
  bare invocation silently checks something else.
- **Do not re-run what a hook already ran.** `hk.pkl` owns the git lifecycle: pre-commit fixes and
  scans, commit-msg enforces conventional commits, pre-push runs `mise run check`. It installs
  itself from mise's `postinstall`. Bypass one command with `HK=0`, never habitually.
- **`tsc` and `vitest` are separate gates.** A green vitest run is not a working build — vitest
  transpiles and never typechecks. Casting a fixture past the type checker defeats both.

## Commands

Tasks live in `.mise/tasks/<folder>/<name>.sh`; the folder is the scope, and a new task belongs in
the folder matching what it can reach. `node_modules/.bin` is on `PATH`, so tasks call binaries
directly — do not add `npx`.

| Task | Command |
| --- | --- |
| Tools, then npm dependencies | `mise install` then `mise deps` |
| Every generic file type | `mise run lint` |
| Apply what the linters can fix | `mise run fmt` |
| ESLint over `src/` and `tests/` | `mise run lint:code` |
| Typecheck | `mise run test:types` |
| Unit tests | `mise run test:unit` |
| Dead files and unused exports | `mise run test:dead` |
| Everything that gates a push | `mise run check` |
| Bundle into `main.js` | `mise run build` |
| Build and install into a vault | `VAULT=/path mise run plugin:install` |

`flint` fans a changed file out to the linter that owns its type; `flint.toml` scopes it. Exclude a
path only with the reason written beside it.

## Versions

- **Never take npm's `latest`.** The Obsidian plugin ecosystem sets the ceiling, and it trails npm
  by a major or more.
- **Derive the ceiling before bumping anything**: read the peer ranges of `eslint-plugin-obsidianmd`
  and `typescript-eslint`, and cross-check against a plugin that is actually maintained
  (`vendor/navigation/notebook-navigator`). Linters and git hooks may run ahead of that ceiling;
  TypeScript, ESLint and the Obsidian typings may not.
- **Pin exactly. No carets.** A range is a version nobody chose.
- **One owner per fact.** `mise.toml` owns tool versions, `package.json` owns npm ones,
  `manifest.json` owns the plugin's id, name, version and description. Do not restate any of them
  elsewhere.
- **`minAppVersion` is a claim you tested**, not an aspiration. Lowering it requires running against
  that version.

## What you must measure, not assume

Every claim about an Obsidian event in this family of plugins was wrong the first time it was
assumed and right only after it was measured.

- **A claim about an event is measured or it is labelled unverified.** `obsidian eval` against a
  live vault, and the probe needs a control that proves it was armed — an empty log is otherwise
  indistinguishable from a dead listener.
- **The typings give signatures, never behaviour.** `obsidian.d.ts` cannot tell you what fires.

Measured on 1.13.2, and the reason the design looks the way it does:

| Move | Events | Verdict |
| --- | --- | --- |
| Open a note or a different `.base` | `active-leaf-change`, `file-open`, `layout-change` | all three fire |
| Switch the view inside one Base | none of those, nor `resize` | **silent** |
| Drag a sidebar divider | `resize` | `layout-change` stays quiet |

`leaf.getViewState()` is the source of truth and is public:

```js
{ type: 'bases', state: { file: '…/kanban-default.base', viewName: 'Kanban Board' } }
```

- **Read `getViewState()` on every wake. Never cache what an event handed you.** An event is a
  wake-up, not a truth.
- **Publish on change, not on arrival.** One user move fires several events; a rule that reacts to
  each of them runs three times.
- A `.base` is an ordinary `TFile`, so path, folder and regex matching apply to it as to a note. An
  in-Base view switch changes `viewName` with no event at all; the only signal is a
  `MutationObserver` on `.bases-toolbar-views-menu`. Not built — no vault here needs it yet.

## Talking to other plugins

- **Anything read off a plugin instance rather than its declared `api` is instance state.** Read it
  defensively and degrade when it is gone.
- **No hard dependency on another plugin.** Every path that uses one must still work without it.

QuickAdd, verified against v2.24.2:

| Route | Coupling | Context |
| --- | --- | --- |
| The choice's ⚡️ toggle registers an Obsidian command | none | not passed |
| `plugins.quickadd.api.executeChoice(name, variables)` | needs their instance | **passed** |

`executeChoice` writes into `choiceExecutor.variables` and their `Conditional` reads the same store,
so a context we pass is a condition they can branch on. It takes a **name**, not an id, and reports
rather than throws when it misses — **store the id and resolve the name at fire time.**

## How the code is built

**A capability that looks too small for a service is still a service.** The class costs one file;
the shortcut costs every later feature that has to route around it. Build the foundation for the
building it will become, not for the one storey standing today.

### Where a thing goes

- **`main.ts` holds no logic.** It constructs services in a fixed order and hands each what it needs.
  Nothing else may be added to it.
- **A capability is a class in `src/services/`.** Not a free function called from the UI, not a
  method bolted onto the plugin class.
- **Algorithms are pure functions in `src/utils/`.** A service holds state, orchestrates and
  notifies; it does not compute. If a method has no `this` in it, it belongs in `utils/`.
- **A type shared by two modules lives in `src/types/`**, never in whichever module happened to
  declare it first.

### How a service is wired

- **A service never imports the plugin class.** It takes `app` and its required collaborators as
  constructor values, and anything that may not exist yet as a thunk — `() => X | null`. Reaching
  back through the plugin for a sibling is what makes construction order load-bearing.
- **A service declares the interface it satisfies** — `class Watcher implements IContextReader`. The
  compiler enforces the contract; a consumer imports the interface, never the class.
- **An interface is the slice one consumer needs**, not the union of everything a service can do.
- **A parent owns its children.** It constructs its sub-services and its `dispose()` cascades into
  theirs. Whatever registers, unregisters.
- **A sub-service folder has an `index.ts`** re-exporting its public names. Outsiders import the
  folder.

### How duplication is prevented

- **The second consumer of a behaviour never copies it.** The behaviour moves into a shared base or
  a shared function **parameterised by a discriminator** — `run(kind, step, context)` — never
  duplicated and never special-cased with `if (kind === …)` at the call sites.
- **A new kind of action is a registered handler, never a branch in a switch.**
- **Every write to persisted data goes through one serialised path.** No module writes settings or
  rules directly; a queue owns ordering so two triggers firing at once cannot interleave a save.

### How state is published

- **A subscription returns its unsubscribe.** `onChange(listener): () => void`, always.
- **Write all state, then notify once.** A listener that runs mid-update sees a half-written object.
- **Derived data is invalidated in the same method that changes its source.** Never in a later one,
  never lazily by hoping.
- **Absence is the default.** A value equal to the default is stored as no value at all, and a reset
  removes the key rather than writing a copy back.

Every module has a named slot: Observer, Provider, Delegation, Facade, Controller, Bridge,
Singleton. A file fitting none of them means the design is wrong, not that the list is short.

### What this plugin owes its users

- **A rule that fires is logged, and so is a rule that matched and did nothing.** This plugin acts
  when nobody is watching the screen; "why did it not run" is the only question users will ask.
- **Nothing vault-specific enters the source.** Paths, base names and view names live in the rules a
  user writes, never in a constant.

## Write facts, not prose

**A comment states what and why in one or two lines. Never more than the code it explains.** Do not
narrate reasoning, restate the code in English, or record your own edits. A comment earns its place
by holding what the code cannot: a measurement, an event that does not fire, the reason the obvious
alternative was rejected. JSDoc carries the contract of an exported symbol.

**The same bar binds this file.** Every line here is either an obligation or a fact an agent would
otherwise get wrong. Descriptions, history and status belong in `README.md`, `TODO.md` and git.

## The quality bar

1. **Wire up what exists** — Obsidian's API, another plugin's, our own service.
2. **Add a new building block, written properly**, when nothing exists to reuse.
3. **Never a workaround.** The only banned category.

## Commits

Conventional commits, enforced by the commit-msg hook. Never commit to `main` — pre-commit refuses.

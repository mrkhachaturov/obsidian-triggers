# Triggers

Runs your Obsidian commands when you enter a context — a note, a
folder, a Base, a view.

Pairs with QuickAdd rather than competing: a rule can run any command,
and it can call a QuickAdd choice while passing the context, so
QuickAdd's own conditions can branch on where you are.

## Status

Early. The rule format is not settled — see `TODO.md`.

## Development

```bash
mise install && mise deps
mise run check
VAULT=/path/to/vault mise run plugin:install
```

## License

MIT

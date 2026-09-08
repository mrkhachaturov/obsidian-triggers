# TODO

The rule format. No settings UI and no persistence until it is written down.

1. One action per rule, or an ordered list of steps — and whether a step carries
   `then`/`else` from the start.
2. Whether a trigger is only an event, or also an interval and a timeout.
3. What a rule does on the way out of a context. A field the user fills, not a
   behaviour the plugin picks.
4. What travels in an exported rule set. A rule referencing a layout by id means
   nothing in another vault.

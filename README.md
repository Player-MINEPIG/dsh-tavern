# dsh-tavern

DSH plugins that bring SillyTavern-style presets to the DeepSeek Harness, with
later support for worldbook (world info) and character-card import.

> Naming note: SillyTavern "preset" here means sampling parameters + prompt /
> instruct templates. It is **not** the DSH "agent-preset", which selects which
> plugins a session is composed from.

## Planned layout

- `packages/tavern-format` — shared SillyTavern format parsing (preset /
  character / world info), zero host dependencies
- `packages/preset` — ST preset import + DSH sampling / system-prompt mapping +
  settings UI
- `packages/character` — (later) character-card import
- `packages/worldbook` — (later) world-info import
- `apps/demo` — a runnable composition for end-to-end verification (optional)

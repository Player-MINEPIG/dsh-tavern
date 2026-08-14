# Prompt preset review guide

## Review scope

This branch implements the prompt-preset vertical slice only: import, durable
storage, edit/create/select UI, and model-request injection. Character cards
and world books are deliberately outside this review.

## Package boundaries

- `packages/tavern-format`: pure parsing, normalization, macro rendering, and
  prompt compilation. It has no dsh or filesystem dependency.
- `packages/preset`: filesystem store, HTTP API, dsh Host hooks, and browser UI.
- `dist/client.js`: generated browser plugin. Review source first; verify the
  generated artifact with `npm run build`.

The root package is the sole installation and release unit. The internal
folders are not nested repositories.

## Runtime data and copyright safety

The default store is `<installed-plugin-root>/data`, containing `state.json`
and one normalized JSON file per preset under `presets/`. The source worktree
ignores `/data`.

The acceptance fixture at
`D:\AI\deepseek-harness\夏瑾 天琴座 Beta 1.0.json` is third-party material.
Tests may read it in place or import it into a temporary/installed-plugin
directory, but must never copy it into the Git worktree, fixtures, snapshots,
generated bundles, logs, or commits.

## SillyTavern compatibility contract

The first release targets SillyTavern Chat Completion preset JSON:

- preserve the original top-level fields for future round-trip work;
- normalize prompt records without discarding unknown extension fields;
- prefer the global Chat Completion order (`character_id: 100001`), otherwise
  choose the order resolving the most prompt identifiers;
- enable/order prompts from `prompt_order`, falling back to prompt-local state
  when no usable order exists;
- skip marker-only entries during dsh prompt compilation;
- preserve role information by labeling compiled sections because dsh exposes
  one system-prompt seam rather than arbitrary interleaved role messages;
- evaluate common ST macros and remove unresolved double-brace macros before
  handing text to dsh, whose own strict `{{variable}}` syntax would otherwise
  reject the request.

## dsh integration contract

- The selected preset is global to this plugin installation, matching ST's
  global Chat Completion preset selection.
- Compiled prompt text is contributed through `systemPrompt.section()` so the
  exact selected preset is recorded in the durable request header.
- The `agent/request` waterfall applies only call-config fields dsh currently
  supports: `temperature`, `maxTokens`, `reasoningEffort`, and `stop`.
- Other ST sampling fields remain editable/preserved compatibility data. They
  are not claimed to reach adapters that do not expose them.
- The preset manager shadows dsh's current single-occupant right `details`
  slot and adds a header utility to reopen it. This is an upstream slot
  limitation, not an accidental UI choice.

## Planned verification

1. Unit tests for parser, prompt order, macro safety, and store traversal/atomic
   persistence.
2. Host-contract test proving selected prompt text and sampling config enter
   the two dsh request seams.
3. API tests for import/create/update/select and payload/error bounds.
4. In-place acceptance parse of the named fixture with structural assertions
   only; no copyrighted strings in snapshots or output.
5. Browser smoke test after local dsh installation.

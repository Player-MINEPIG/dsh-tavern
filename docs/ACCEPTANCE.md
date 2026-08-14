# Prompt preset acceptance record

## Scope and environment

- Date: 2026-08-14
- Branch/worktree: `feature/prompt-preset-gpt` in `prompt-preset-gpt`
- dsh: `0.1.0-rc.6`
- Execution: a unique temporary `DSH_HOME`; no normal user profile, main
  worktree, or sibling worktree was modified.
- External fixture: read/imported only from
  `D:\AI\deepseek-harness\夏瑾 天琴座 Beta 1.0.json`.

This record contains only structure, counts, lengths, booleans, and test-owned
values. It intentionally contains none of the fixture's prompt text.

## Automated checks

`npm run check` built the browser bundle and passed 13/13 tests. Coverage includes:

- ST Chat Completion parsing and `character_id: 100001` order preference;
- macro rendering and strict-brace removal;
- traversal-safe, atomic persistence plus reload;
- HTTP import/create/update/select flows;
- selected preset injection into `systemPrompt.section()` and `agent/request`;
- in-place structural parsing of the external acceptance fixture;
- portable lifecycle argument construction and uninstall backup behavior.

`npm run pack:check` completed successfully. The package preview contained 12
release files, including the three lifecycle scripts, and excluded runtime
`data/`, the external fixture, docs, tests, and local dependency caches.

## Installed-plugin results

| Check | Observed result |
| --- | --- |
| Plugin install and boot | Host API and browser bundle loaded in the isolated dsh Web profile |
| External ST import | 140 prompts; 20 enabled, non-marker prompts |
| Prompt order | Chat Completion order `character_id: 100001` selected |
| Compiled plugin section | 4,776 characters; no unresolved `{{...}}` macro |
| Imported sampling projection | temperature `1`, max tokens `32000`, reasoning effort `high` |
| Storage | preset JSON and state created below the installed plugin's `data/` directory |
| Right panel | displayed the imported preset, all 140 prompt editors, roles, markers, and sampling controls |

## UI create/configure/select results

The browser flow created and automatically selected `UI created preset`, then
saved test-owned values temperature `0.42` and max tokens `888`. After selecting
the imported preset and selecting the created preset again, the name, one prompt,
and both values were restored. This proves creation persistence and subsequent
selection through the same UI/API path used by a reviewer.

## Message-path evidence

Two real `session.prompt` requests were accepted by dsh and completed their turn
records in the isolated profile. Inspection used only metadata and boolean
checks, never copied system-prompt contents:

- Imported preset request: the durable `request/header.system` was 11,006
  characters, contained the dsh-tavern marker and imported preset name, contained
  no unresolved strict macro, and carried temperature `1`, max tokens `32000`,
  reasoning effort `high`.
- UI-created preset request: the latest durable header contained the dsh-tavern
  marker and `UI created preset`, contained no unresolved strict macro, and its
  config carried temperature `0.42` and max tokens `888`.

These durable request headers are the dsh request-assembly boundary, so they
directly demonstrate that a sent message carried the selected preset. A
placeholder credential was used only in the disposable profile; provider-side
model quality or authentication was outside this plugin acceptance scope.

## Cleanup

The disposable dsh server is stopped and its exact temporary profile is removed
after review. That removal also destroys the temporary imported copy and the
placeholder credential. The external source file remains untouched.

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

`npm run check` built the browser bundle and passed 19/19 tests. Coverage includes:

- ST Chat Completion parsing and `character_id: 100001` order preference;
- macro rendering and strict-brace removal;
- traversal-safe, atomic persistence plus reload;
- HTTP import/create/update/select flows;
- selected preset injection into `systemPrompt.section()` and `agent/request`;
- in-place structural parsing of the external acceptance fixture;
- portable lifecycle argument construction and uninstall backup behavior.
- system-prompt replacement preserving tools, runtime contexts, and variables;
- immutable prompt-list reordering used by the direct drag handle.
- visible insertion-boundary to array-index conversion for upward, downward,
  end-of-list, and no-op drops.
- one-way package boundaries keeping DSH Host policy out of the format and
  preset store layers.

`npm run pack:check` completed successfully. The package preview contained 16
release files, including all three internal layers and the three lifecycle
scripts, and excluded runtime
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
| Blank-session access | root overlay showed a visible `预设` launcher before the first message; it opened a 420px drawer and restored the launcher after close |

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

## Stage 7 targeted regression

A second disposable profile at port `53104` tested only the new synchronization
and prompt-policy work; previously accepted import/create/edit/delete behavior
was treated as stable baseline.

| Regression | Observed result |
| --- | --- |
| Initial selected state | After page load the panel did not render the empty-preset instruction; it settled directly on the selected synthetic preset |
| Reopen refresh | A preset deleted through the API while the mounted drawer was stale disappeared after close/reopen; the stale option was absent and the empty state was current |
| Drag affordance | Every prompt summary exposed a left-of-checkbox `⠿` pointer-drag handle; reorder transformation is covered independently by an immutable unit contract |
| Advanced replace policy | UI displayed the reliability warning, saved `systemPromptMode: replace`, and the API returned the saved mode |

The browser automation transport did not reliably synthesize a continuous
pointer drag, so the physical pointer gesture remains a short manual review
item. The UI event path and its reorder transformation are separately covered;
this limitation is about the test driver, not a claim of completed gesture
acceptance.

## Stage 8 sidebar exclusivity regression

The installed package was exercised in another disposable profile with a
blank workspace session and then an active session produced by a test-owned
message. A placeholder API key intentionally failed provider authentication;
the durable failed turn was sufficient to enter the active-session UI without
using a real credential.

| State | Observed result |
| --- | --- |
| Installed dependency | One `dsh-tavern` dependency and one profile bundle entry |
| No session / blank session | One floating launcher; opening created one visible drawer; one close removed it |
| Active session, panel open | One header `预设` button, zero floating buttons, one native panel about 359 px wide |
| Active session, after one close | Native panel width became 0; header button remained; no floating button appeared |
| Active session, reopen | One header click restored the native panel to about 359 px |

This confirms that uninstall-before-reinstall is not required to prevent the
reported duplicate controls. A running dsh process must still be restarted so
it loads the newly built client bundle.

## Stage 10 architecture-split regression

The refactored root package was installed into a fresh isolated profile at
`D:\AI\deepseek-harness\test-envs\gpt-architecture`. The test used only a
synthetic preset and did not import or copy the external fixture.

| Check | Observed result |
| --- | --- |
| Installed root entry | `packages/tavern-loader/src/index.js` |
| Real dsh Host boot | Web server and `/dsh-tavern/api` started successfully |
| Preset use-case layer | Created, updated, selected, and read a synthetic preset through HTTP |
| Loader compiled output | Active preview contained `ARCHITECTURE_ACCEPTANCE_MARKER` |
| Request config projection | temperature `0.33`, max tokens `777` |
| Installation units | One `dsh-tavern` dependency; no separately installed format/parser plugin |

Together with the Host contract tests, this establishes that the split changed
module ownership without removing the actual agent-loading path. The previously
accepted browser UI bundle was rebuilt unchanged from its source entry. The
synthetic profile was uninstalled without backup and its exact temporary
directory was removed after recording these results.

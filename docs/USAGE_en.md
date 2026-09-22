# dsh-tavern usage guide

[中文](USAGE_zh-CN.md)

This guide covers the current orb interaction, frontend display-mode switch, RP workspace admission, character-card create/edit, playthrough lifecycle, imported-record opening bind, external persistent storage, RP secure mode, and delegated child agents inheriting the parent's Tavern selection. Message flow, architecture, and security contracts are in `DSH_MESSAGE_FLOW_en.md`, `ARCHITECTURE_en.md`, and `LOADER_CONTRACT_en.md`. RP block/allow list: [RP_SECURE_MODE_en.md](RP_SECURE_MODE_en.md).

## When an error occurs in RP

On the target DSH `0.1.7-alpha.1`, exposed Session errors or the latest turn's terminal failure show: “An error occurred. Switch to the Chat view for more information.” Select DSH's Chat tab for the detailed cause. RP does not switch views automatically or duplicate provider diagnostics. The notice follows Tavern's UI language. A new request in progress hides the previous turn's failure; later success or intentional cancellation supersedes old errors. Automatic retries in progress and recoverable tool errors alone are not terminal failures.

### Workspace and playthrough read problems

Open **DT → Diagnostics** for problems in the current RP workspace, in either native or Mowan mode. The sidebar shows one dismissible summary. The `⚠` beside an affected playthrough opens its details, even when the playthrough itself cannot be opened.

A readable timeline also receives a warning when none of its sessions are available in the current RP workspace, including archived, moved, or unavailable sessions. Empty playthroughs are checked too; a healthy new empty playthrough is not flagged just for having no messages. Checks wait for the DSH session and workspace lists to finish loading.

The panel shows the affected character/playthrough, cause, and recovery advice. Expand **Technical details** for the error code, file path, and any session ID in the error. **Copy diagnostics** copies the displayed list; **Copy this problem** copies one item. Reports include local paths and object IDs; review before sharing.

**Recheck** reads the current workspace again. Dismissing the summary does not remove problems. Rechecks, page reloads, and native/Mowan switches in the same browser tab do not re-alert dismissed identical problems. New problems are shown, and a successful check automatically removes resolved ones. Closing the browser tab ends this dismissal preference.

This panel shows current read problems, not a historical log. It does not persist prompt, conversation, or error bodies and adds no v3 API. Backend operations continue to use the DSH logger / operationId; model request failures remain available through the Conversation view described above.

## Quick Start: shortest RP path

Do one full turn in this order the first time. The screenshot version is in the Chinese [README](../README.md#quick-start从角色卡到第一轮-rp-对话). The [English README](../README_en.md) has no images.

1. Left-click the `DT` orb and import an ST JSON or PNG card on the **Character card** page.
2. Return to native DSH and create a workspace that will be used for RP.
3. Right-click `DT` to enter Mowan. On first entry, explicitly choose the RP workspace you just created.
4. In the RP sidebar, click `+` on the target card to create or reuse that character's latest empty playthrough.
5. Choose a greeting in the opening dock; keep the current greeting if there is no alternate.
6. Send the first user message from the native DSH composer.

This path does not write greeting as history and does not copy a DSH session. Import other resources, display regex, swipe, branch, rollback, imported records, and export after the first turn works.

## 1. Open and switch panels

After install and DSH Web restart, the page shows an orb always labeled `DT`: native (Lingzhu) is blue-white, play (Mowan) is red-black.

- Drag the orb to move it. Position is remembered in the browser. Ending a drag does not accidentally expand the menu.
- Left-click immediately expands or collapses the menu. Rapid repeated clicks repeat that default toggle; double-click has no special effect. Right-click switches frontend display mode. After the server confirms, the divider rotates once and the colors transition. Mode state does not wait for the animation. Rotation is skipped when the system prefers reduced motion.
- Menu buttons say **Switch to custom frontend mode** or **Switch to DSH native mode**, and may show **Current: Mowan** or **Current: DSH native**. The tooltip is **Switch frontend display mode**. No marketing copy.
- The menu stays mounted. Content fades in after the 220ms expand so the first-row switch button does not flash. After any sidebar opens, the orb remains so you can switch modules.
- A glowing green dot next to a resource means the current session has that resource enabled; red means it is not. A world-book green dot means an effective binding exists, not that keywords hit this turn.
- The title shows currently enabled content. The in-panel “browse/edit target” can differ from the session binding. Trust the binding state and **Not applied** hints.
- If a preset, character card, user, world book, session template, display regex, or imported record fails completely, the UI shows an **Import failed** dialog in addition to the existing inline error. If the resource imported successfully and only has compatibility diagnostics or warnings, only the panel diagnostics stay; no failure dialog.
- **UI settings** can switch Simplified Chinese/English, scale Tavern UI from 75%–150%, and choose a default RP workspace from existing DSH workspaces. It also toggles **Follow character into RP** and edits optional `rp:policy` text. The default RP workspace is authoritative via `GET/PUT /v2/workspace` and is not copied into UI settings. Changes affect only the default location of new playthroughs and RP/ordinary session classification. They do not move existing sessions, directories, catalog, or timeline. Language/scale/follow are global; the RP switch itself is per-session. Lock list: [RP secure mode](RP_SECURE_MODE_en.md).
- The first time you enter Mowan without an RP workspace, a workspace picker appears instead of an empty RP UI. The page lists only existing DSH workspaces. A single candidate is still not auto-selected. After you click a candidate, wait for write and read-back. If the previous binding is stale or read/write fails, use **Check again** or **Return to DSH mode**. System-disk candidates still require a second confirmation.

## 2. Presets

The preset panel can import SillyTavern Chat Completion preset JSON or create a blank preset. After saving edits, use **Export JSON** to download the current resource.

Reasoning effort offers inherit, off, low, medium, high, extra high, and maximum (`max`). Other valid provider effort IDs from imported files are preserved and displayed in the selector; editing unrelated fields does not clear them. Choosing inherit clears Tavern's explicit override. Available values still depend on the target model/provider; preserving a value does not mean every model supports it.

1. Choosing a preset from the list only opens it for browse/edit. It does not automatically affect the current session.
2. You can edit the name, append/replace system strategy, DSH-supported sampling parameters, and prompt-block enablement, role, content, and order.
3. Drag the handle left of a prompt to reorder. The dragged source shrinks to a bar; the drop target shows a placeholder.
4. After saving the resource body, click the blue bind/update button to apply it to the current session. Unbinding does not delete the resource.
5. An explicit preset switch is rejected while the agent is running. Retry after the current turn ends.

`append` keeps existing DSH system sections. `replace` keeps only the model-visible Tavern profile text. Code Mode, structured output, or tool-prompt reliability may drop, but file sandbox, approval, and tool execution stay on.

## 3. Character cards

The character panel supports SillyTavern V1/V2/V3 JSON and PNG files that contain `chara`/`ccv3` data.
Imports read `tags: null` as no tags and report a compatibility warning while preserving the original field. Other invalid types and arrays containing non-string tags still fail validation.

1. After import or create, you can edit name, description, personality, scenario, greeting (including alternates), example dialogue, and similar fields. Saving fields and binding to a session are two steps. The plugin stores one current card document. PNG import also keeps a cover image with card data stripped. PNG export uses a placeholder when there is no cover. There is no “export original file”.
2. Choose a greeting and whether the card system prompt and post-history instructions take priority. If the current card is already bound, changing greeting or policy without binding again shows **not applied**.
3. Click bind/update to apply to the current session. Another session can bind a different character. A delegated subagent freezes the parent session's Tavern selection at that moment (same as **New chat with current settings**). Whether the spawn prompt narrows the task is up to the parent agent / preset author.
4. Unbind only removes the session selection. Delete removes the card document and cover from the plugin library and clears stale session selections. Playthroughs that still reference the card appear under **Missing character cards** in the Mowan sidebar, using the pre-delete name. Re-importing the same file (unique SHA-256 match) or a uniquely same-named card automatically restores the playthrough and all descendant session bindings. If uniqueness cannot be decided, use **Relink** next to the missing card; the UI will not guess from a shared name. Each playthrough's ⋯ menu also has **Relink character card**, which migrates only that playthrough and its branch sessions. If the target is outside the automatic classification rule, a warning appears, but you can still confirm your choice.
5. The Mowan sidebar top can sort cards by **Recently updated**, **Name A–Z**, or **Custom**. **Recently updated** uses DSH session summaries and orders by the newest conversation activity under that card; cards with no session fall back to resource `updatedAt`. Drag is allowed only in Custom. Switching modes does not clear a saved custom order.

description, personality, scenario, example dialogue, and similar fields enter the unified Tavern profile through preset markers or a stable fallback. Loader metadata and diagnostics describe greeting placement and provenance; greeting is never forged as an assistant history message that already happened.

### Display regex

The display-regex page lists rules from global, current preset, and current character card. Drag the handle left of a rule title to reorder within the same source. The interaction matches preset prompt sorting: the dragged item shrinks to a line and the drop target shows a dashed placeholder. After **Save changes**, global order is written to the workspace regex document; preset/card order is written back to each native `regex_scripts` array. Sources cannot be dragged across each other. Combined order is always global → preset → character. Rules run top to bottom, so interdependent rules such as conditional clears and tag extraction must stay in the intended order.

### Markdown, HTML, and template styles

Markdown inside `<details><summary>Title</summary>` is parsed without requiring extra blank lines after summary. Nested details, lists, emphasis, and fenced code are supported. A closed unlabeled or `html` fence containing a complete `<html>…</html>` document or `<head>…</head><body>…</body>` pair renders as a static HTML template, with HTML comments and a document declaration allowed. Ordinary HTML fragments, other languages, indented code, and unclosed fences remain literal code. Use a `text` fence to display a complete document's source. Ordinary raw HTML containers retain HTML semantics.

Templates can use `<style>`, Flex/Grid, and CSS `@keyframes` for horizontal bars, blinking, and transitions, with native `<details>` for expansion. Stylesheets are isolated per message and inherit the current font, color, and CSS variables; template selectors cannot style other messages or DSH chrome. Recognized complete documents are isolated separately. Standalone `:root`, `html`, and `body` style rules, including rules inside media groups, map to the template root to retain theme variables and base typography. Compound selectors and document-root selectors in ordinary raw HTML fragments should still use a template root class. Content is clipped to its message boundary. Template JavaScript, event handlers, and iframes remain blocked. Script-generated content, button logic, and MVU or other variable APIs do not automatically work; provide static content for those parts. Static HTML exports retain the same isolated styles and require a modern browser with declarative Shadow DOM support.

Display regex `trimStrings` removes every occurrence of each listed literal string from captures. To preserve inner HTML, do not include `<`, `>`, spaces, or backticks. Remove only intended wrapper markers, such as `<!-- begin_of_Subtext_think -->` and `<!-- end_of_Subtext_think -->`. The renderer cannot reconstruct tags already deleted by a rule. Edit or replace the imported rule and **Save changes**; avoid running old and new copies on the same content. Original DSH messages stay unchanged; redisplaying them applies the updated rules.

## 4. World books

The world-book panel lists five sources:

- standalone books explicitly selected for the current session;
- standalone books bound to the current user;
- standalone books bound to the current preset;
- standalone books bound to the current character card;
- the current card's embedded `character_book`.

Standalone books can be imported, created, edited, exported, and deleted. Checking a session world book shows a not-applied state until you click the blue apply button. User, preset, and character bindings and the embedded book stay as separate sources and are not mixed into one resource document. A standalone book can be opened from any source entry in the same editor.

Entry editing supports primary/secondary keys (English or Chinese commas), secondary logic, constant, enabled, case, whole-word, position, order, probability, and body. The collapsed title shows constant, disabled, or key conditions. Ordinary keys scan bounded durable history plus this step's claimed input, so the first message of an empty session can activate in the same turn. JavaScript regex keys are blocked by default.

Composition order is session explicit → user-bound → preset-bound → character-bound → embedded book. Standalone books are first de-duplicated by ID with earlier sources winning. The embedded book then joins the same matcher as its own resource. Matcher input is at most 10,000 entries per request. A later resource that cannot fit as a whole is skipped and diagnosed.

## 5. Users

A user resource is strictly name and description. It has no avatar and does not override DSH Agent identity.

**SillyTavern format compatibility:** This panel imports and exports one user in Tavern JSON; these files and ST persona backups cannot be imported into each other directly. ST Persona Management provides Backup / Restore for the entire persona list, including names, descriptions, related settings, and the default persona, but excluding avatar images and chat bindings. Restore merges data and skips existing internal identifiers. The official documentation states that these backups contain internal links and are not designed for sharing individual personas. See the [ST persona documentation](https://docs.sillytavern.app/usage/core-concepts/personas/#pro-tips).

1. Use **New user**, select an existing user, or **Import JSON** from a Tavern user file. Fill the name the model should use and the user description. Creating and editing do not require a session binding.
2. **Export JSON** downloads the saved name and description. Import creates a new user without replacing same-name resources, binding a session, or carrying user–world-book relations. Select and save those relations separately after import.
3. The name can be used as `{{user}}`. The description is placed once via the `personaDescription` marker, `{{persona}}`, or a stable fallback.
4. A user can bind zero or more standalone world books. User body and world-book relations are two separate saves. The panel shows unsaved changes.
5. Save, then bind/update to the current session. Unbinding a user removes the user description and that world-book source. It does not delete world books the session selected explicitly.

User–world-book relations are global. Changing them affects later requests on every session bound to that user. They do not rewrite a frozen `request/header` or existing history.

## 6. New session and configuration templates

Switching resources in the same session does not delete assistant replies already influenced by the old resources. To avoid leftover context, use **New session**:

- In DSH mode, **New chat with current settings** copies the current preset, character/greeting options, user, standalone world books, and RP state onto a real blank DSH session.
- In Mowan, the same entry and **From selected template** read the configured character card, create or reuse that character's empty playthrough, then apply the complete selection to its root session. A configuration with no character card cannot create a playthrough; switch back to DSH mode for an ordinary session.
- Templates store the same bounded selection projection and can be previewed before create.
- **Create blank template** works without a current session. Select a template, edit its name, preset, character card, user, ordered world books, opening number, character-prompt preferences, and saved RP settings, then **Save changes**. This does not alter current session bindings.
- **Create from current settings** and **Update from current settings** still capture the current session's actual configuration. Save and apply resource-panel changes before using these actions.
- **Export JSON** downloads the saved template name, settings, and resource ID references without bundling those resources. Import creates a new template and preserves the previous default-template selection. Explicitly select the imported template and review its references and diagnostics; IDs are not automatically remapped by name between libraries.
- New sessions do not copy durable history, Inbox, Trace, resource bodies, or old runtime state.
- Missing template resources show diagnostics and block apply.

The target DSH outer **New session** control belongs to the native sidebar shell. The public extension contract does not let Tavern intercept or replace its click. Mowan keeps the native button and does not recommend it in RP mode. The `+` next to **Ordinary / non-RP sessions** only shows an explanation; it can be dismissed or used to return to native DSH. It does not silently create, move, or rename sessions. Create playthroughs with the `+` on a character card.

The normal UI applies templates only to a newly created blank session. The underlying apply API still has no global transaction lock against an arbitrary already-running target. See the running-agent risk notes in `LOADER_CONTRACT_en.md`.

## 7. Playthroughs and imported opening records

Clicking new playthrough under a card in the Mowan sidebar creates or reuses that character's latest `Playthrough N` that has no real record. The generated title follows the current UI locale (`{number}周目` in Chinese); an explicit rename stays verbatim across locales. Reuse checks `timeline.json`, DSH user/assistant messages on the root session, an open turn, and whether imported QA already exists, so repeated clicks do not create endless empty playthroughs. The menu next to the title can rename. The clicked card is the authority for the create transaction. After create or reuse, the plugin checks and if needed corrects the root session character binding, then shows that card's greeting, regardless of which recent focus DSH new-session inherited. Create only makes a real blank DSH session and playthrough metadata. It does not write greeting or forge messages.

If a session already assigned to a playthrough is unbound in the character panel, or rebound to a different card, a confirmation appears first. After confirm, the target session and all descendant branches detach from the original timeline and become unassigned under the new binding. Sibling branches, original DSH history, and the empty playthrough remain. Cancel changes neither selection nor timeline. Creating a new playthrough for the original character later attaches a new blank DSH session to that empty playthrough and reuses the name and number.

Before a top bar exists, greeting appears in the opening dock under the native composer. Left/right buttons switch alternate greetings, skipping blank alternatives while preserving original card indices. Each direction is disabled at its boundary, without wrapping. An already selected blank opening retains navigation back to a valid greeting. A card with no greeting still keeps the empty area and the same footer. The center import button binds an ST JSON/JSONL record; once bound it becomes rebind and unbind. After bind, the dock previews the last three QA turns as local render only.

Imported records can bind only to a still-empty root session. On the first real request, the loader establishes a durable claim only after the same profile snapshot provides at least one public `claimEventSeqs`, then gives the model escaped, `untrusted`, read-only system context. It does not forge DSH user/assistant QA and is not written to Tavern `timeline.json`. This system context is part of the actual model request, so official DSH session/request history may retain its body. A view/assembly without a claim does not inject or consume pending. The same claim identity may reassemble before terminal; `turn/end` only consumes an already-claimed binding and stores non-body terminal metadata (event seq, turn, `reason.kind`). A DSH provider request retry does not consume or reset the claim. Tavern swipe copies body-free lineage through the public branch; the child session needs a new claim. After interrupt, a new claim on the original session no longer injects. After a real user/assistant message, an open turn, or a claimed binding, rebind and unbind are locked.

The branch button at the end of a reply creates a new playthrough from that adopted reply. The new playthrough inherits DSH durable history up to that point, copies the current display timeline, and opens the child session that can continue. Source playthrough and source messages are not rewritten. The operation is a client composition of public atomic APIs. Extreme disk or network failure may leave a child session/file that never entered the catalog; diagnose from backend operation-log stages.

Mowan fully hides reasoning, child-agent reports, completion notices, and tool context, with no expand control. Switch to native DSH **Chat** when you need them. Parent output triggered by that context still belongs to the same durable QA. Right-swipe on that QA walks forward to the nearest real user message and reruns the whole turn; it never sends a context report as a user message. Missing a real user message fails explicitly. There is currently no action to hide an entire QA. Display regex processes assistant body per segment; cleared segments are not rendered. Whether a QA has many assistant segments or all bodies were cleared, one action group stays at the QA end, and non-visual provenance and playthrough pointers remain.

Replies triggered by a real user use ST-style left/right swipe. The index is shown from the first reply (`1/1`). Left adopts the previous existing item. Right adopts the next existing item, or becomes **Try again** on the last item and creates and adopts a new swipe. There is no separate star generate button. After **Try again**, the new DSH session opens as soon as it is created, before the reply finishes. Clicking the playthrough again or switching to native **Chat** during the wait targets that same session. RP shows the preceding context, the current user message, and the streamed reply; use **Stop generation** in the native composer to interrupt it. Transient text is not written as a timeline variant. After termination, only DSH-persisted user/assistant coordinates can be adopted, including any reply persisted after interruption. If failure leaves no reply to save, an error offers **Return to saved reply** and existing variants remain unchanged.

Pending navigation belongs to the current frontend instance. Reloading or closing the page loses that temporary association; the new DSH session remains available through native session navigation for inspection and cancellation.

**Branch from here as a new playthrough** copies the active path through that reply into a new playthrough. **Continue from here in this playthrough** only moves the current playthrough head to that reply's DSH branch session. Both keep old DSH history. The difference is whether a new playthrough is created. The next turn after rollback becomes a tree continuation; the old continuation stays stored but is not rendered on the active path.

A new branch starts with inherited pending input cleared, including queued and steering messages, without changing the source session’s queue. If cleanup fails, the operation reports an error and does not navigate to that branch.

**Edit display text** expands an in-place resizable multiline editor. It does not call the browser single-line prompt. Save updates only timeline `displayOverride`; Cancel or Esc discards. The original DSH assistant message and later model context do not change. The saved value is final display text: later macros and display regex are skipped, but Markdown/HTML still goes through DOMPurify. An empty save still keeps **Restore original reply**. Restore clears the override and reruns the current display pipeline from DSH source.

The playthrough ⋯ menu provides **Export static HTML** and **Export SillyTavern JSONL**. Static HTML exports greeting, user messages, and assistant bodies after current display rules on the active path, for reading or sharing. SillyTavern JSONL exports greeting, the active path, and each QA's `swipes` / `swipe_id` for ST import. It keeps known swipe items for each active QA, but ST JSONL cannot express the full playthrough tree, so unused later branches, cross-session lineage, and the Tavern catalog are not saved. To restore the complete switchable tree, back up the RP workspace, the session logs in its corresponding `DSH_HOME`, and Tavern's persistent resources and selections together. Do not treat JSONL or the RP workspace alone as a project backup.

Import files and binding summaries live under the selected play workspace root. The server checks path, hash, and `schemaVersion: 1` / QA structure. The import parser does not summarize, slice QA, or apply a 256 KiB / 2,000 QA artificial cap. Context overflow is left to DSH/provider. Generic workspace files still have a 1 MiB file-layer limit.

### Archive and restore playthroughs

Choose **Archive playthrough** in a playthrough's `⋯` menu to remove it from the everyday list. **Archived playthroughs** at the bottom of the sidebar is collapsed by default; expand it to view a run or choose **Restore playthrough** to return it to its character. Viewing does not restore it automatically. An already open conversation stays open and any reply in progress continues.

Archiving preserves the name, number, branches, display edits, external-record references, and session settings. Its sessions do not reappear as loose sessions in Mowan; a session shared with another active playthrough remains visible there. New runs do not reuse archived empty playthroughs and continue the existing numbering. Archived runs do not produce everyday diagnostic warnings; restoration checks them again.

This organizes Tavern playthroughs only. It does not archive native DSH sessions, delete history, or reclaim disk space. Native DSH lists still expose the sessions. Older Tavern versions can read the same data but do not hide archived playthroughs.

## 8. Tavern Trace

Tavern Trace is a sibling of Conversation and Trajectory. Each request record
first shows its captured preset, character, user, world books, prompt mode, model,
and Tavern sampling configuration. Expand **World-book activation** for matches,
rejections and budgets; expand **Loader assembly** for official sections, source
metadata, contexts, and observed system messages. Schema 4 detail performs a cold read of
official DSH history. Section/context bodies appear only after verification; source
bodies are neither stored nor reconstructed. Existing schema 3 bodies remain viewable
and are labeled as legacy snapshots. Current v1 resources describe current
configuration and are never presented as historical originals.

Current captures combine schema 4 metadata and official-history references in bounded
`tavern-trace-records.json`. It contains no section, context, system-message, or
source-body copies. Defaults shared by all Sessions in one directory are 16 MiB,
256 records, and 2 MiB per record. Eviction never deletes DSH history. Missing
history, an unavailable cut, or identity/hash/range verification failure is explicit;
the reader never reassembles current resources or falls back to another full-text
copy. Old `tavern-traces.json` and `tavern-assemblies.json` remain read-only; the
latter may still contain sensitive bodies captured before upgrade. Request
observation is not model success, and DSH durable history remains the body authority.
See [v3 API and limits](PROMPT_API_V3_en.md).

## 9. RP secure mode

RP is an overlay on the current session, not a DSH agent preset.

1. The RP switch on the character panel controls this session. **Follow character into RP** in UI settings is on by default, so binding a card enters RP automatically.
2. Turn the switch off or send `/rp off` to leave. Changing file permissions in the chat bar cannot unlock it.
3. When on: writes, terminal, and outbound fetch are rejected. Local reads are limited to the current workspace and do not read `.env` and similar secret names. Intercept shows an information dialog (not approval) and cancels that agent's current turn.
4. Child agents may be spawned. The child inherits the same limits and freezes the parent's Tavern selection (same as **New chat with current settings**). Whether the spawn prompt narrows the task is up to the parent agent. The plugin does not encode delegation policy in `rp:policy`.
5. UI settings can edit optional `rp:policy` text. The default only says high-risk operations are locked. Identity and style belong in the preset or card. Empty text attaches no section; the lock still applies. Bottom **Restore defaults** resets only language, scale, and character-follow. It does not change this prompt.

Full block/allow list: [RP_SECURE_MODE_en.md](RP_SECURE_MODE_en.md).

## 10. Data, backup, and uninstall

Default data location:

```text
<DSH_HOME>/pmp-dsh-tavern/
```

Main contents:

```text
presets/                       Normalized preset documents
state.json                     Current default preset state
characters/                    Current character-card documents
character-artifacts/           Cover images left by PNG import (no card data)
character-state.json           Character sort, missing-card tombstones, and related UI state
world-books/                   Standalone world books
users/                         User names and descriptions
session-selections.json        Per-session selection (including RP state)
user-world-book-bindings.json  User–world-book relations
resource-world-book-bindings.json Preset/character–world-book relations
session-templates.json         Configuration templates (including RP projection)
tavern-trace-records.json      Schema 4 Trace metadata and official-history references
tavern-traces.json             Legacy v1 Trace metadata (read-only after upgrade)
tavern-assemblies.json         Legacy schema 3 body snapshots (read-only; may be sensitive)
ui-settings.json               Global language, scale, and character-follow RP
conversation-settings.json     Mowan body/greeting and message-action scale
rp-policy.json                 Optional rp:policy prompt
chrome.json                    Lingzhu/Mowan frontend display mode and revision
play-workspace.json            Current RP workspace binding
import-context-bindings.json   Runtime claim state for imported records
```

If the plugin is configured with a custom `storageDir`, the same tree is stored there. Back up the whole Tavern directory; do not copy only `presets/`. `play-workspace.json` stores only the RP workspace pointer. The actual `catalog.json`, per-playthrough `timeline.json`, display regex, and imported records live in the chosen DSH workspace, while the session bodies and branch history referenced by the timeline remain in the corresponding `DSH_HOME` official session logs. A restorable complete backup must include the Tavern persistent directory, selected RP workspace, and corresponding DSH data, including session logs and inherited dependencies.

On the first upgrade from legacy package-local `data/`, the project installer stages and restores that old tree across remove/add. If the external directory is empty, the new Host copies it atomically, writes a migration marker, and retains the old copy; a populated target is never overwritten. The uninstaller snapshots the persistent directory to `<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/` by default, then removes only the package and retains the original directory. `--no-backup` skips the snapshot rather than erasing content; pass `--storage-dir` to snapshot a custom location.

Full install, refresh recovery, cross-platform options, and uninstall: [Installation](INSTALLATION_en.md).

## 11. Current compatibility boundaries

**Conversation settings** and **UI settings** in the Mowan menu are independent. **Body and greeting size** scales only Mowan user/assistant messages, greeting, and **Thinking**. **Message button size** scales only the copy, swipe, branch, rollback, and edit actions at the end of each turn. Both range from 75%–150%, apply immediately, persist across refresh, and restore independently to 100%. They do not change native DSH chat, outer Tavern panels, the composer, prompts, history, or exports.

- ST `system`/`user`/`assistant` prompt roles are retained only as source metadata describing the requested insertion position; the labels are not written into prompt bodies. The loader expands the ordered preset and markers into multiple named DSH system sections, not real interleaved role messages.
- `chatHistory` is always provided by DSH durable history. The plugin does not copy history.
- example dialogue, greeting, PHI, and depth/absolute placement use the current marker/fallback placement; Loader metadata and diagnostics report ST semantics that cannot be represented exactly.
- World books do not fully execute recursive, sticky/cooldown/delay, vector, strict depth/role, or outlet semantics.
- Only DSH-supported `temperature`, `maxTokens`, `reasoningEffort`, and `stop` are mapped. Other ST samplers are stored and not claimed as delivered.
- ST macros implement a common subset, not a full SillyTavern runtime.

More precise ST, TauriTavern, and DSH message-topology differences: `PROMPT_PIPELINE_en.md`.

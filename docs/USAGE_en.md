# dsh-tavern usage guide

[中文](USAGE_zh-CN.md)

Status: 2026-08-22. Covers the current orb interaction, frontend display-mode switch, RP workspace admission, character-card create/edit, playthrough lifecycle, imported-record opening bind, RP secure mode, and delegated child agents inheriting the parent's Tavern selection. This page is operational. Message flow, architecture, and security contracts are in `DSH_MESSAGE_FLOW_en.md`, `ARCHITECTURE_en.md`, and `LOADER_CONTRACT_en.md`. RP block/allow list: [RP_SECURE_MODE_en.md](RP_SECURE_MODE_en.md).

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
- If a preset, character card, world book, display regex, or imported record fails completely, the UI shows an **Import failed** dialog in addition to the existing inline error. If the resource imported successfully and only has compatibility diagnostics or warnings, only the panel diagnostics stay; no failure dialog.
- **UI settings** can switch Simplified Chinese/English, scale Tavern UI from 75%–150%, and choose a default RP workspace from existing DSH workspaces. It also toggles **Follow character into RP** and edits optional `rp:policy` text. The default RP workspace is authoritative via `GET/PUT /v2/workspace` and is not copied into UI settings. Changes affect only the default location of new playthroughs and RP/ordinary session classification. They do not move existing sessions, directories, catalog, or timeline. Language/scale/follow are global; the RP switch itself is per-session. Lock list: [RP secure mode](RP_SECURE_MODE_en.md).
- The first time you enter Mowan without an RP workspace, a workspace picker appears instead of an empty RP UI. The page lists only existing DSH workspaces. A single candidate is still not auto-selected. After you click a candidate, wait for write and read-back. If the previous binding is stale or read/write fails, use **Check again** or **Return to DSH mode**. System-disk candidates still require a second confirmation.

## 2. Presets

The preset panel can import SillyTavern Chat Completion preset JSON or create a blank preset.

1. Choosing a preset from the list only opens it for browse/edit. It does not automatically affect the current session.
2. You can edit the name, append/replace system strategy, DSH-supported sampling parameters, and prompt-block enablement, role, content, and order.
3. Drag the handle left of a prompt to reorder. The dragged source shrinks to a bar; the drop target shows a placeholder.
4. After saving the resource body, click the blue bind/update button to apply it to the current session. Unbinding does not delete the resource.
5. An explicit preset switch is rejected while the agent is running. Retry after the current turn ends.

`append` keeps existing DSH system sections. `replace` keeps only the model-visible Tavern profile text. Code Mode, structured output, or tool-prompt reliability may drop, but file sandbox, approval, and tool execution stay on.

## 3. Character cards

The character panel supports SillyTavern V1/V2/V3 JSON and PNG files that contain `chara`/`ccv3` data.

1. After import or create, you can edit name, description, personality, scenario, greeting (including alternates), example dialogue, and similar fields. Saving fields and binding to a session are two steps. The plugin stores one current card document. PNG import also keeps a cover image with card data stripped. PNG export uses a placeholder when there is no cover. There is no “export original file”.
2. Choose a greeting and whether the card system prompt and post-history instructions take priority. If the current card is already bound, changing greeting or policy without binding again shows **not applied**.
3. Click bind/update to apply to the current session. Another session can bind a different character. A delegated subagent freezes the parent session's Tavern selection at that moment (same as **New chat with current settings**). Whether the spawn prompt narrows the task is up to the parent agent / preset author.
4. Unbind only removes the session selection. Delete removes the card document and cover from the plugin library and clears stale session selections. Playthroughs that still reference the card appear under **Missing character cards** in the Mowan sidebar, using the pre-delete name. Re-importing the same file (unique SHA-256 match) or a uniquely same-named card automatically restores the playthrough and all descendant session bindings. If uniqueness cannot be decided, use **Relink** next to the missing card; the UI will not guess from a shared name. Each playthrough's ⋯ menu also has **Relink character card**, which migrates only that playthrough and its branch sessions. If the target is outside the automatic classification rule, a warning appears, but you can still confirm your choice.
5. The Mowan sidebar top can sort cards by **Recently updated**, **Name A–Z**, or **Custom**. **Recently updated** uses DSH session summaries and orders by the newest conversation activity under that card; cards with no session fall back to resource `updatedAt`. Drag is allowed only in Custom. Switching modes does not clear a saved custom order.

description, personality, scenario, example dialogue, and similar fields enter the unified Tavern profile through preset markers or a stable fallback. greeting is explicitly labeled reference content and is never forged as an assistant history message that already happened.

### Display regex

The display-regex page lists rules from global, current preset, and current character card. Drag the handle left of a rule title to reorder within the same source. The interaction matches preset prompt sorting: the dragged item shrinks to a line and the drop target shows a dashed placeholder. After **Save changes**, global order is written to the workspace regex document; preset/card order is written back to each native `regex_scripts` array. Sources cannot be dragged across each other. Combined order is always global → preset → character. Rules run top to bottom, so interdependent rules such as conditional clears and tag extraction must stay in the intended order.

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

1. Create or select a user and fill the name the model should use and the user description.
2. The name can be used as `{{user}}`. The description is placed once via the `personaDescription` marker, `{{persona}}`, or a stable fallback.
3. A user can bind zero or more standalone world books. User body and world-book relations are two separate saves. The panel shows unsaved changes.
4. Save, then bind/update to the current session. Unbinding a user removes the user description and that world-book source. It does not delete world books the session selected explicitly.

User–world-book relations are global. Changing them affects later requests on every session bound to that user. They do not rewrite a frozen `request/header` or existing history.

## 6. New session and configuration templates

Switching resources in the same session does not delete assistant replies already influenced by the old resources. To avoid leftover context, use **New session**:

- In DSH mode, **New chat with current settings** copies the current preset, character/greeting options, user, standalone world books, and RP state onto a real blank DSH session.
- In Mowan, the same entry and **From selected template** read the configured character card, create or reuse that character's empty playthrough, then apply the complete selection to its root session. A configuration with no character card cannot create a playthrough; switch back to DSH mode for an ordinary session.
- Templates store the same bounded selection projection and can be previewed before create.
- Updating a template reads only the current session's actual settings. Finish and save configuration in the DT resource panels first.
- New sessions do not copy durable history, Inbox, Trace, resource bodies, or old runtime state.
- Missing template resources show diagnostics and block apply.

The DSH rc.8 outer **New session** control belongs to the native sidebar shell. The public extension contract cannot intercept or replace its click. Mowan keeps the native button and does not recommend it in RP mode. The `+` next to **Ordinary / non-RP sessions** only shows an explanation; it can be dismissed or used to return to native DSH. It does not silently create, move, or rename sessions. Create playthroughs with the `+` on a character card.

The normal UI applies templates only to a newly created blank session. The underlying apply API still has no global transaction lock against an arbitrary already-running target. See the running-agent risk notes in `LOADER_CONTRACT_en.md`.

## 7. Playthroughs and imported opening records

Clicking new playthrough under a card in the Mowan sidebar creates or reuses that character's latest `N playthrough` that has no real record. Reuse checks `timeline.json`, DSH user/assistant messages on the root session, an open turn, and whether imported QA already exists, so repeated clicks do not create endless empty playthroughs. The menu next to the title can rename. The clicked card is the authority for the create transaction. After create or reuse, the plugin checks and if needed corrects the root session character binding, then shows that card's greeting, regardless of which recent focus DSH new-session inherited. Create only makes a real blank DSH session and playthrough metadata. It does not write greeting or forge messages.

If a session already assigned to a playthrough is unbound in the character panel, or rebound to a different card, a confirmation appears first. After confirm, the target session and all descendant branches detach from the original timeline and become unassigned under the new binding. Sibling branches, original DSH history, and the empty playthrough remain. Cancel changes neither selection nor timeline. Creating a new playthrough for the original character later attaches a new blank DSH session to that empty playthrough and reuses the name and number.

Before a top bar exists, greeting appears in the opening dock under the native composer. Left/right buttons switch alternate greetings. A card with no greeting still keeps the empty area and the same footer. The center import button binds an ST JSON/JSONL record; once bound it becomes rebind and unbind. After bind, the dock previews the last three QA turns as local render only.

Imported records can bind only to a still-empty root session. On the first real request, the loader establishes a durable claim only after the same profile snapshot provides at least one public `claimEventSeqs`, then gives the model escaped, `untrusted`, read-only context. It does not become DSH durable history and is not written to `timeline.json`, so it does not forge a QA. A view/assembly without a claim does not inject or consume pending. The same claim identity may reassemble before terminal; `turn/end` only consumes an already-claimed binding and stores non-body terminal metadata (event seq, turn, `reason.kind`). A DSH provider request retry does not consume or reset the claim. Tavern swipe copies body-free lineage through the public branch; the child session needs a new claim. After interrupt, a new claim on the original session no longer injects. After a real user/assistant message, an open turn, or a claimed binding, rebind and unbind are locked.

The branch button at the end of a reply creates a new playthrough from that adopted reply. The new playthrough inherits DSH durable history up to that point, copies the current display timeline, and opens the child session that can continue. Source playthrough and source messages are not rewritten. The operation is a client composition of public atomic APIs. Extreme disk or network failure may leave a child session/file that never entered the catalog; diagnose from backend operation-log stages.

Mowan fully hides reasoning, child-agent reports, completion notices, and tool context, with no expand control. Switch to native DSH **Chat** when you need them. Parent output triggered by that context still belongs to the same durable QA. Right-swipe on that QA walks forward to the nearest real user message and reruns the whole turn; it never sends a context report as a user message. Missing a real user message fails explicitly. Hide was removed. Display regex processes assistant body per segment; cleared segments are not rendered. Whether a QA has many assistant segments or all bodies were cleared, one action group stays at the QA end, and non-visual provenance and playthrough pointers remain.

Replies triggered by a real user use ST-style left/right swipe. The index is shown from the first reply (`1/1`). Left adopts the previous existing item. Right adopts the next existing item, or becomes **Try again** on the last item and creates and adopts a new swipe. There is no separate star generate button. After **Try again**, Mowan immediately keeps that turn's user message, hides the old reply, shows **Thinking**, and optimistically updates `n/n` to `n+1/n+1` without waiting for the full branch-session reply. Failure restores body and index together. Success hands off atomically to the new session's authoritative messages and timeline.

**Branch from here as a new playthrough** copies the active path through that reply into a new playthrough. **Continue from here in this playthrough** only moves the current playthrough head to that reply's DSH branch session. Both keep old DSH history. The difference is whether a new playthrough is created. The next turn after rollback becomes a tree continuation; the old continuation stays stored but is not rendered on the active path.

**Edit display text** expands an in-place resizable multiline editor. It does not call the browser single-line prompt. Save updates only timeline `displayOverride`; Cancel or Esc discards. The original DSH assistant message and later model context do not change. The saved value is final display text: later macros and display regex are skipped, but Markdown/HTML still goes through DOMPurify. An empty save still keeps **Restore original reply**. Restore clears the override and reruns the current display pipeline from DSH source.

The playthrough ⋯ menu provides **Export static HTML** and **Export SillyTavern JSONL**. Static HTML exports greeting, user messages, and assistant bodies after current display rules on the active path, for reading or sharing. SillyTavern JSONL exports greeting, the active path, and each QA's `swipes` / `swipe_id` for ST import. It keeps known swipe items for each active QA, but ST JSONL cannot express the full playthrough tree, so unused later branches, cross-session lineage, and the Tavern catalog are not saved. To keep a complete switchable tree, back up the whole RP workspace; do not treat JSONL as a project backup.

[Playthrough review record](PLAY_REVIEW_en.md).
Import files and binding summaries live under the selected play workspace root. The server checks path, hash, and `schemaVersion: 1` / QA structure. The import parser does not summarize, slice QA, or apply a 256 KiB / 2,000 QA artificial cap. Context overflow is left to DSH/provider. Generic workspace files still have a 1 MiB file-layer limit.

## 8. Tavern Trace

Tavern Trace is a view sibling of Conversation and Trajectory. It explains which Tavern configuration a turn/step actually used.

It shows preset, character, user, and world-book summaries; configured and matched world-book keys; accept/reject reasons; budget; and request/header alignment. Early-activation metadata for the current input is aligned to the same record.

Trace does not store the full Tavern profile, user messages, resource bodies, or tool schemas, and it cannot replace DSH `request/header`. The latter remains the authoritative model request header. Trace uses bounded plugin storage and can recover recent records after refresh or Host restart.

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
<DSH_HOME>/profiles/<profile>/node_modules/pmp-dsh-tavern/data/
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
tavern-traces.json             Bounded Trace metadata
ui-settings.json               Global language, scale, and character-follow RP
conversation-settings.json     Mowan body/greeting and message-action scale
rp-policy.json                 Optional rp:policy prompt
chrome.json                    Lingzhu/Mowan frontend display mode and revision
play-workspace.json            Current RP workspace binding
import-context-bindings.json   Runtime claim state for imported records
```

If the plugin is configured with an external `storageDir`, the same tree is stored there. Back up the whole `data/` directory; do not copy only `presets/`. `play-workspace.json` stores only the RP workspace pointer. The actual `catalog.json`, per-playthrough `timeline.json`, display regex, and imported records live in the chosen DSH workspace. A complete backup must copy that workspace too.

Re-running the installer stages and restores in-plugin `data/`. The uninstaller backs up to `<DSH_HOME>/backups/pmp-dsh-tavern/<timestamp>/` by default. Use `--no-backup` only when you are sure the data is not needed. External import source files and an external `storageDir` are not deleted by the uninstaller.

Full install, refresh recovery, cross-platform options, and uninstall: [Installation](INSTALLATION_en.md).

## 11. Current compatibility boundaries

**Conversation settings** and **UI settings** in the Mowan menu are independent. **Body and greeting size** scales only Mowan user/assistant messages, greeting, and **Thinking**. **Message button size** scales only the copy, swipe, branch, rollback, and edit actions at the end of each turn. Both range from 75%–150%, apply immediately, persist across refresh, and restore independently to 100%. They do not change native DSH chat, outer Tavern panels, the composer, prompts, history, or exports.

- ST `system`/`user`/`assistant` prompt roles currently enter one DSH system section as reviewable labels, not real interleaved role messages.
- `chatHistory` is always provided by DSH durable history. The plugin does not copy history.
- example dialogue, greeting, PHI, and depth/absolute placement use an explicitly labeled system approximation or diagnosed fallback.
- World books do not fully execute recursive, sticky/cooldown/delay, vector, strict depth/role, or outlet semantics.
- Only DSH-supported `temperature`, `maxTokens`, `reasoningEffort`, and `stop` are mapped. Other ST samplers are stored and not claimed as delivered.
- ST macros implement a common subset, not a full SillyTavern runtime.

More precise ST, TauriTavern, and DSH message-topology differences: `PROMPT_PIPELINE_en.md`.

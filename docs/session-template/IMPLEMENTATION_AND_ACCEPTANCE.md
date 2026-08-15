# Tavern clean sessions and configuration templates

Status: implemented on `feature/session-templates` against DSH `0.1.0-rc.6`.

## Outcome and scope

The Tavern launcher now has a **新会话** surface with two clean-session paths:

1. copy the current session's Tavern settings into a clean DSH session;
2. save, name, select, rename/update, delete and apply reusable configuration templates.

The copied projection is exactly the loader-owned selection shape:

- preset id;
- character-card id;
- stable greeting index;
- character-system-prompt and post-history switches;
- user id;
- ordered, de-duplicated standalone world-book ids.

No operation reads, serializes or appends DSH messages. Templates contain no durable history, request header, Tavern Trace record, Inbox item, turn/step identifier, streaming state, tool state or model output. Character, preset, user and world-book documents remain in their existing resource stores; templates keep bounded ids and switches only.

The selected-template UI resolves those ids through the current resource
stores and displays the complete stored projection: preset title, character
title, greeting index, both character switches, user title and ordered
standalone world-book titles. Missing resources remain visible by id and share
the existing blocking diagnostic. No prompt, persona, character or lore body is
copied into the template response. Creating and updating deliberately remain
"from current settings" operations; a localized notice directs the user to the
DT launcher panels to review or change the active configuration first.

## Public DSH seam research

The implementation was chosen after read-only inspection of the installed rc.6 public READMEs, declarations and emitted source:

- `@deepseek-ai/dsh-client-runtime/README.md` defines New Session as `WorkspaceRuntime.connectWorkspace(workspaceId)`: reuse a real blank session belonging to that workspace or call Host `session.create`, then return an id already present in the list mirror.
- `client/contract/workspaces.d.ts` publishes `IWorkspaces.connectWorkspace()`.
- `client/contract/sessions.d.ts` publishes `ISessions.open()` for navigation and deliberately omits direct `create()` from the feature-facing sessions service.
- `client/sessions/service.d.ts` states that `open()` may synchronously address the id returned by creation.

The client therefore calls only `ctx.workspaces.connectWorkspace(workspaceId)` and `ctx.sessions.open(sessionId)`. It does not cast to the concrete SessionRuntime, call the private connection API, construct a Session, fork history, or write a session log. DSH may reuse a hidden blank session; that is the documented native New Session semantic and the returned session is still clean.

An unaccounted current session has no public workspace target for `connectWorkspace`. The UI blocks creation with a diagnostic asking the user to add/open a DSH workspace; it does not guess from cwd or silently register a workspace. With no current session, template creation uses DSH's published `recentWorkspaceId` target, matching the native New Session fallback.

## Transaction and navigation order

```text
preview source configuration and validate every referenced resource
  -> DSH connectWorkspace (reuse/create a real blank session)
  -> atomically replace the target's one SessionSelectionStore record
  -> sessions.open(target)
  -> dispatch dsh-tavern:refresh
```

Failure behavior:

| Failure | Result |
| --- | --- |
| missing/deleted preset, character/greeting, user or world book | no DSH create call; structured diagnostics name the missing id |
| DSH create/connect failure | no target Tavern selection write and no navigation |
| resource deletion between preview and apply | apply revalidates and fails before selection commit |
| selection capacity or atomic-write failure | SessionSelectionStore keeps its previous in-memory/file state; no navigation |
| success | navigation occurs only after the complete selection is durable; session-id change plus shared refresh reload every Tavern panel/status |

If DSH created a blank session before a later Tavern write failure, the Host remains its owner and may reuse that blank on the next New Session attempt. There is no half-written Tavern selection and no unsupported Host deletion is attempted.

## Storage and API bounds

`session-templates.json` is plugin-local and atomically replaced. Its schema contains `schemaVersion`, one selected template id and a template array. Defaults and hard limits are:

- 100 templates by default, hard maximum 200;
- 120 characters / 480 UTF-8 bytes per name;
- at most 100 world-book ids per template and at most 200 characters per resource id;
- 512 KiB default state budget, 2 MiB hard configurable state budget;
- files above 4 MiB are rejected before `JSON.parse`;
- 64 KiB per template/configuration API request.

All routes remain below the single `/dsh-tavern/api` registration and pass through the existing loopback/Host/same-origin/content-type wrapper:

- `GET|POST /session-templates`
- `GET|PATCH|DELETE /session-templates/:id`
- `POST /session-templates/select`
- `POST /session-configurations/preview`
- `POST /session-configurations/apply`

Template list responses are bounded by the same global file budget. Each list
item includes a derived, non-persisted `contents` summary containing only ids,
display names, missing flags and character switches so the browser can render
the stored selection without issuing one request per resource. Resource
deletion intentionally does not rewrite templates: the stored intent remains
visible and the list/apply endpoints return explicit diagnostics instead of
silently choosing another resource.

## Architecture review

`packages/session-template` is a use-case layer. Its model/store/API know only the bounded Tavern selection projection and injected resource policies; they import neither DSH nor `tavern-loader`. The root loader wires real stores and owns application to `SessionSelectionStore`. The browser composition root owns DSH workspace creation/navigation. Tavern format still only parses and normalizes content; no UI builds a final system prompt.

Security/data review findings:

- template names and ids are JSON-rendered as text; no HTML injection path is used;
- API writes remain same-origin JSON and loopback by default;
- ids never become filesystem paths;
- state changes use copy/validate/atomic-write/publish order;
- tests use temporary directories only and never mutate a real DSH profile;
- no secrets, absolute machine paths or imported user content are persisted in repository artifacts.

## Automated verification

Focused coverage is in:

- `test/session-template.test.mjs`: persistence, selection fidelity, limits, reload, missing-resource diagnostics and failed-apply rollback;
- `test/session-template-api.test.mjs`: CRUD, naming, selection, current-setting update, preview/apply and request bounds;
- `test/session-template-client.test.mjs`: public seam order, DSH failure, apply failure, no premature navigation and workspace membership resolution;
- `test/client-shell.test.mjs`: launcher integration, DSH public method usage and refreshed panel composition;
- `test/architecture.test.mjs`: use-case/loader/Host dependency boundary.

Required gate: `npm run check` builds `dist/client.js` and runs the complete suite.

## Manual acceptance

Use an isolated DSH profile and synthetic resources:

1. Open a workspace session, select a preset, character greeting and both character switches, a user, and multiple independent world books.
2. Open **DT -> 新会话** and choose **维持当前 Tavern 设置新开对话**.
3. Confirm DSH navigates to a blank session in the same workspace. `/active?sessionId=<new-id>` must show the copied selection; the conversation view and Tavern Trace must be empty.
4. Send one message in the new session and confirm only that session receives new durable history/Trace.
5. Return to the source, create and name a template, select it, and verify the
   panel lists the resolved preset, character/greeting/switches, user and
   ordered world books. Use the DT panels to change current bindings, return to
   the template panel, and use **用当前设置更新**. Restart DSH and confirm the
   template, preview and selected id reload.
6. Create from the template and verify all saved ids, greeting and switches, with no source history.
7. Delete one referenced resource. Confirm the template shows the exact missing id and refuses creation without navigation or a new selection record.
8. Delete the template and confirm existing sessions/resources are unchanged.

Known acceptance boundary: an unaccounted DSH session cannot use the public workspace New Session seam until it belongs to a workspace. No direct private `sessions.create` adapter was added.

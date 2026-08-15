# Tavern launcher status implementation and acceptance

Status: implemented and integrated into the 2026-08-15 public release candidate.
This file retains the module-level implementation and acceptance contract.

## Scope and boundary

This module owns browser composition for the single Tavern launcher and its
selection indicators. It does not create, edit, delete, select or compile
resource documents. Preset and character panels retain their existing API
ownership; the unified loader remains the only owner of per-request prompt
composition and Host seams.

The launcher reads `GET /dsh-tavern/api/active?sessionId=...`. It never treats
the displayed state as request authority: DSH `request/header` remains the
record of content actually sent to a model.

## Display contract

`launcherResourceStatuses(snapshot)` accepts the current active-view shape:

```text
selection.presetId
selection.characterCardId (or characterId)
selection.worldBookIds (or worldBooks / worldBookSelection.ids)
selection.userId (or userProfileId / personaId)

resources.preset
resources.characterCard (or character)
resources.worldBooks
resources.user (or userProfile / persona)
selected                         legacy preset fallback
catalog / catalogs              optional title lookup supplied by later modules
```

Resource titles accept `name`, `title`, `displayName` or `label`. Unknown
optional fields are ignored. Missing snapshot fields produce stable red,
unbound rows rather than an exception. If a selection exists but its catalog
entry is temporarily unavailable, the resource ID is shown as an honest
fallback.

World-book status is derived from `selection.worldBookIds` plus resolved
selected resources such as a character's embedded book. It deliberately does
not read `matchedEntryCount`, `activeEntryIds`, keywords or trace results. A
selected book with zero matches is green; an unselected catalog item is red
even if a fixture includes match-like metadata.

## Refresh and lifecycle

- Changing the host session clears the prior snapshot immediately and starts a
  generation-guarded fetch for the new session. A late response from the old
  session cannot overwrite the new session status.
- Successful preset create/import/update/delete/select and character
  import/delete/bind/unbind operations dispatch `dsh-tavern:refresh`.
- The launcher, preset panel, character panel and world-book panel consume the
  shared event. Events from the panel that performed a mutation carry a source
  marker so that panel does not perform a redundant second catalog refresh.
- Switching resource panels also requests a refresh. The floating ball remains
  mounted while a side panel is open and sits one layer above that panel.
- Escape closes the expanded launcher menu first, then the open resource panel.
  A panel's close button closes only that panel and leaves the launcher entry.
- Only the client composition root registers `shell.overlay`; preset and
  character modules do not create extra launchers.

The position remains stored under the existing browser-local key. Invalid or
unavailable browser storage falls back to the viewport-clamped default without
disabling the launcher.

## Automated acceptance

The focused launcher suite covers:

- stable menu identity and one overlay registration;
- drag clamping, expansion direction and enlarged status-menu geometry;
- two session snapshots with different selections and no cross-session state;
- current resource titles plus optional future catalog title lookup;
- multiple world-book names and explicit count;
- selection-only world-book dots, including zero-hit and catalog-only cases;
- backward compatibility with legacy preset active responses and absent fields;
- shared refresh announcements after resource mutations;
- retained launcher mounting, panel layering and Escape close behavior.

Repository-wide acceptance commands:

```powershell
npm run check
npm run pack:check
```

Final command results should be reviewed with the feature commit. All test data
used by this module is synthetic and declared inline; no third-party preset,
character card, world book or persona fixture is included.

Recorded result on 2026-08-15:

- focused launcher suite: 7/7 passed;
- `npm run check`: browser bundle built, 84 passed, 0 failed, 1 optional
  external-fixture test skipped because no reviewer fixture was supplied;
- `npm run pack:check`: passed, 35 files, with tests and review documents
  excluded from the publish set;
- diff whitespace, sensitive-value, local-machine path and backend-boundary
  scans: clean.

## Manual review checklist

1. Open session A, select a preset and character, and verify their names and
   green dots without closing the launcher panel.
2. Open session B with no bindings and verify all applicable rows are red;
   switch back to A and verify A's names return.
3. Bind two world books and verify both names plus `2 本`; use a conversation
   with no matching lore keyword and verify the World Book dot remains green.
4. Rename/save or delete the selected preset, then bind/unbind or delete the
   selected character. Verify launcher text and dots refresh immediately.
5. Switch Preset, Character, World Book and User panels repeatedly. Verify only
   one launcher exists and its ball stays reachable while a panel is open.
6. Drag the ball to every viewport edge, reload, resize the viewport and verify
   restored/clamped placement and inward menu expansion.
7. Expand the menu over an open side panel. Verify the launcher is above the
   panel; press Escape once to close the menu and again to close the panel.

## Known limits

- The current base branch has no standalone world-book library or user-profile
  panel. Their later modules must expose selection/resource summaries through
  the active view and dispatch the shared refresh event after mutations.
- This feature does not add server push. Changes made outside the browser UI are
  visible on session change, panel switch or the next explicit shared refresh.
- Visual behavior requires a host browser smoke test because the repository's
  automated client tests validate pure state and source lifecycle contracts,
  not pixel rendering.

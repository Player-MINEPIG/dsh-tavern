# DSH 0.1.2 Compatibility and Market Release Plan

Current workspace: `2.2.0` (unreleased), a DSH compatibility update with additive public API support. See [the migration guide](DSH_0.1.5_MIGRATION_en.md) for scope and verification. The completed `2.1.0` ledger below remains historical.

## Current status (2026-09-09)

Tavern `2.1.0` acceptance and final review are complete. The approved changes
were merged, and `main` and the `v2.1.0` tag were pushed at `d9fedf7` on
2026-09-07. No GitHub Release was created. Supported DSH remains exactly
`0.1.2-rc.1` (upstream tag `dsh-v0.1.2-rc.1`).

User-confirmed credential onboarding, API error notices, and Market screenshots,
plus fresh-profile GitHub installation of the dependency-compatibility candidate,
close the corresponding earlier gates. See [the acceptance summary](PLAY_REVIEW_en.md)
and [changelog](CHANGELOG.md) for completed checks and future regression guidance.
The dated development records below retain their original scope and evidence;
their pending labels describe those historical stages, not outstanding `2.1.0`
acceptance. They do not imply that every possible integration scenario was tested.

## RP error notice follow-up (2026-09-07)

User acceptance now confirms initial credential onboarding and exact-ref
GitHub installation of `03354a81752ded3bf73db67afb87a71bad550ce2`.
These results supersede the pending entries in the earlier dated ledger.
An invalid API key exposed a remaining RP failure-display gap.

Work on `codex/rp-error-notice`, based on `03354a8`, in two rollback stages:

1. **Implementation and tests:** aggregate public DSH `0.1.2-rc.1` Session
   errors with the latest Chat timeline terminal error. Add one localized,
   sticky RP notice directing readers to native Chat. Do not copy provider
   details, alter credentials, persist errors, or change durable history.
   Cover later success/cancellation, in-progress submission/retry, empty
   turns, separate sessions, and locale changes.
2. **Documentation and evidence:** synchronize paired architecture, frontend
   and usage guides, changelog, editable diagram and PNG. Record automated,
   browser and user-confirmed acceptance separately. No push/tag/release.

Implementation status: complete in `4f8a698`. `npm run check`: 528 pass, 2 existing skips.
Independent read-only review: no required findings; 9 focused tests pass.
The local candidate was installed in the older isolated profile and loaded
in DSH Web; completed-history and blank-opening rendering showed no false
notice. The exact-ref acceptance profile was left unchanged.

Historical runtime gate (subsequently closed by user acceptance): reproduce an actual provider failure with this new
bundle, inspect details in native Chat, then verify successful retry clears
the RP notice. Evidence identifier: `rp-error-notice-20260907`; the private
report, Host screenshot and accessibility capture stay outside this repository.
Unit/component tests cover these state transitions but are
not a replacement for real-provider acceptance. Credentials were not changed.

## Computer-use regression fixes (2026-09-06)

The real-browser pass found client contract regressions despite the earlier
automated checks. Work on `codex/cu-acceptance-fixes`, starting at `248bede`:

1. **Chat/Trace data ownership:** replace removed Session `nodes/partial`
   reads with the public DSH `0.1.2-rc.1` Chat projection; add split-snapshot
   regressions, retaining Session lifecycle and DSH durable-history authority.
2. **Opening dock/default RP:** derive blank/engaging phase from the public
   Conversation contract and reuse the Conversation-owned view store (not the
   Chat store). Verify greeting before the first send, default RP after send,
   explicit native Chat selection, and disposal on mode/session changes.
3. **Live localization:** subscribe RP/sidebar/dock presentation to locale as
   well as scale, preserve raw resource/user titles, and repair the missing
   world-book drag label. Verify Chinese/English switching without reload.
4. **Documentation and diagram:** synchronize both architecture languages,
   frontend guidance, changelog, editable draw.io source and rendered PNG with
   Session/Conversation/Chat ownership; preserve the existing overall design.
5. **Runtime acceptance:** build/install this local candidate only in the
   isolated test profile; repeat the failed browser checks with screenshots,
   console and session/header evidence, then record the result. No push/tag.

Each meaningful implementation stage is committed separately with its tests
so it can be reverted. Initial credential onboarding and controlled provider
error/retry are separate unverified gates, not fixes inferred from this pass.
Progress: all five repair stages completed locally on 2026-09-06. The five
reported browser regressions and the missing world-book label are closed for
the tested conditions. This is not a declaration that every release gate passed.

| Repair stage | Commit | Result |
| --- | --- | --- |
| Plan | `e9e4b7e` | Recorded scope and independent rollback stages |
| Chat / Trace | `eb753eb` | Public Chat projection replaces removed Session fields |
| Opening / default | `ae1e7bc` | Official Conversation phase and shared view store |
| Browser boundary | `ebdf867` | Runtime imports isolated at the browser entry |
| Locale / world book | `cc9f056` | Reactive settings consumers and complete drag labels |
| Locale roster follow-up | `6796ed4` | RP tab changes language without repeating default choice |
| Documentation / diagram | `1400aea` | Paired contracts, changelog, editable source and PNG |

Verification: `npm run check` passed (522 pass, 2 fixture-dependent skips),
`npm run verify:2.0` passed (163 package files), and independent read-only
review reported no required findings with 25 focused tests passing. The local
installed bundle equals the repository bundle byte for byte.

Computer-use retest: empty greeting; first-send default RP; partial text while
generation is active; completed text; old/new Trace views; live bilingual
sidebar/dock/RP/tab labels; native selection retained on locale change;
world-book label; and native/play mode disposal/reentry. Three real-provider
turns have durable terminal events and actual header references (including
header reuse). Evidence identifier: `cu-fixes-20260906`; the private report,
screenshots, DOM, raw synthetic-session export and source index stay outside
the public repository. Original `cu-acceptance-20260906` evidence is unchanged.

Still separate gates: initial credential onboarding, controlled provider-error
retry and complete cancellation semantics, exact-ref GitHub installation,
broader import/export/uninstall matrix, external-plugin compatibility, and
personal RP/Market screenshot review. No credentials were replaced, no normal
profile was modified, and no push/tag/release was performed.

Original compatibility-stage status: implementation and local automated
acceptance complete; the repair addendum above supersedes its browser-failure
status. The ledger below describes `codex/dsh-0.1.2-compat` work. It is not a statement
about a published release until the remaining acceptance gates below are
complete.

Target integration baseline: DSH `0.1.2-rc.1` at upstream tag
`dsh-v0.1.2-rc.1`. The previous Tavern candidate commit `eb7e257` remains the
rollback point. This work intentionally does not provide a dual adapter for DSH
`0.1.1`; compatibility with that prerelease remains historical evidence only.

Every numbered implementation stage is an independent Git commit. A stage is
complete only when its focused tests pass. No release tag, publication, or
remote push is implied by this plan.

## Commit ledger

| Stage | Commit | Persisted outcome |
| --- | --- | --- |
| Plan | `08e0405` | Recorded the DSH `0.1.2-rc.1` compatibility, release, rollback, and acceptance plan. |
| Commit 1 | `c76ecbc` | Replaced the removed Host proxy with the Tavern-owned controller adapter and UUID request ids. |
| Commit 2 | `79eebef` | Added cold-safe, stable-cut, unbounded message-aligned history pagination. |
| Commit 3 | `5d512e8` | Centralized supported Session event snapshots and seeded-child ownership reads. |
| Commit 4 | `01eb78a` | Declared the nine client contract owners and adopted public workspace navigation. |
| Commit 5 | `47856ed` | Synchronized full-version documentation and added editable/rendered current architecture views. |
| Commit 6 | `2566192` | Prepared `2.1.0-rc.2`, including locale-aware generated playthrough titles and package boundaries. |
| Acceptance fix | `37f637b` | Made Tavern own the DSH UUID helper's complete runtime dependency chain, removing profile peer warnings. |

## P0: runtime compatibility

### Commit 1: migrate the Play Host adapter to public controllers

- Replace the removed `apiProxy` calls with explicit
  `sessionController`, `workspaceController`, and
  `directoryPickerController` dependencies at the Tavern composition root.
- Preserve the Tavern-owned Play Host port (`createSession`, `forkSession`,
  `promptSession`, `history`, and workspace operations) so DSH request and
  response shapes do not leak into `packages/play`.
- Map create, rename, fork, prompt, workspace insertion, workspace creation,
  and directory creation through the DSH `0.1.2-rc.1` controller contracts.
- Generate `SessionPromptRequest.requestId` with DSH's official
  `@deepseek-ai/dsh-util-crypto` UUID helper.
- Add focused controller-shape, error-mapping, request-id, and injection tests.

Rollback boundary: Host calls only; no Tavern HTTP or persistent-data schema
changes.

### Commit 2: pin a stable history pagination cut

- Use `sessionController.inspect()` to obtain a cold-safe, inclusive
  `throughSeq`, then read message-aligned pages with
  `sessionController.page()`.
- Keep the first `throughSeq` across every page in one Tavern history read.
- Preserve discriminated `event` and packed `chunks` records and the existing
  cursor-stall protections.
- Do not use `follow()` for one-shot history reads because it may promote a
  cold session to a live Agent.
- Test empty, single-page, multi-page, concurrent-append, packed-chunk, and
  stalled-cursor cases.

Rollback boundary: read algorithm only; no history writes or migrations.

### Commit 3: replace removed `Session.events` access

- Centralize current-log snapshot access in a small internal helper.
- Use `session.seq` for length, `eventAt()` for point reads,
  `snapshotEvents()` for stable half-open ranges, and `ownEvents()` when the
  fork-inherited prefix must be excluded.
- Migrate trace header lookup, pending-input reconstruction, sandbox folding,
  and open-turn checks.
- Test ordinary and seeded sessions, inherited prefixes, child-owned setup
  events, sandbox restoration, pending input, and trace correlation.

Rollback boundary: in-memory access only; durable DSH and Tavern formats stay
unchanged.

### Commit 4: migrate client services and UI contract ownership

- Remove manifest references to the deleted client runtime and slots packages.
- Declare the direct session/workspace API and renderer/session/workspace/
  layout/sidebar/conversation/chat UI contract owners required by Tavern.
- Route workspace navigation through `ctx.uiWorkspace` while keeping the
  Tavern workflow transport-independent.
- Keep the public slot names unchanged and continue to reuse the native Chat
  store for the default RP view, failing closed if it is unavailable.
- Test slot props, native/RP switching, one-Chat ownership, mount/disposal,
  manifest resolution, and the generated client bundle.

Rollback boundary: client loading and navigation only; Host compatibility
commits remain independently usable.

## P1: documentation and Market candidate

### Commit 5: synchronize compatibility documentation and architecture views

- Record DSH `0.1.2-rc.1` as the candidate compatibility baseline using full
  prerelease versions in current-facing documentation.
- Preserve historical version statements and append an explicit compatibility
  delta instead of presenting older message-flow research as a new full audit.
- Update Host, history, Session, workspace-navigation, install, security, and
  acceptance contracts to match the implemented public seams.
- Add an editable draw.io architecture diagram of the current system and a
  rendered preview. The diagram must show the DSH Host/client boundary, the
  Play Host adapter, pure resource and policy packages, loader composition,
  client slots, DSH-authoritative session history, and Tavern-owned persistent
  storage.
- Validate the `.drawio` structure, export a draft, visually inspect it, and
  keep the diagram source free of workstation paths, secrets, and private
  planning data.

Rollback boundary: documentation and diagram artifacts only.

### Commit 6: prepare the `2.1.0-rc.2` Market candidate

- Bump package and lockfile versions to `2.1.0-rc.2` only after P0 passes.
- Update the changelog and package/Market metadata without rewriting historical
  entries.
- Refresh localized Market screenshots only after the corresponding browser
  locale passes; Chinese listing assets use Chinese UI and English listing
  assets use English UI.
- Verify the packed artifact contains the intended public documentation and
  diagram assets and excludes tests, runtime data, and development-only
  material. `docs/DEV_PLAN.md` remains development-only unless publication is
  explicitly authorized.

Rollback boundary: release metadata and Market assets only.

## Automated acceptance

- Complete: focused tests at every implementation commit.
- Complete: `npm run check`, `npm run verify:2.0`, and package dry-run. The
  518-test suite has 516 passes, two fixture-dependent skips, and no failures
  on Node 20 and Node `22.23.1`; production audit reports zero vulnerabilities.
- Complete: draw.io source validation, rendered export, and visual inspection.
- Complete: local-source install, uninstall with backup, retained-data check,
  clean reinstall, peer check, DSH Web boot, and HTTP smoke in the isolated
  `DSH_HOME` using DSH `0.1.2-rc.1`. The installed package is
  `2.1.0-rc.2` and the Tavern data directory remains outside the package.
- Complete: browser smoke for the launcher, native/play navigation, existing
  playthrough history, Tavern Trace registration, locale switching, refresh,
  and generated `1周目` / `Playthrough 1` display. The test environment was
  restored to Chinese afterward.
- Pending until remote push is authorized: repeat the same clean install from
  the exact GitHub branch/ref instead of the local source path.

## Manual acceptance

- First credential entry with a real provider; the Tavern launcher must remain
  visible without requiring a page refresh.
- A real streamed response, queue/steer, cancel/error/retry, fork continuation,
  RP tone, character/preset/world-book behavior, and trace/header alignment.
- Human review of Chinese and English UI copy and Market screenshots.

The installed `dsh-codex-subscription 1.11.2` does not declare compatibility
with DSH `0.1.2-rc.1` and still references removed client packages. It cannot
serve as acceptance evidence for this candidate. Built-in DSH provider
acceptance may proceed; Codex-subscription acceptance waits for a compatible
external plugin release and is not part of Tavern's implementation commits.

Super Injector is outside Tavern's dependency and API scope. Only coexistence
smoke is included; its own Settings behavior is not repaired here.

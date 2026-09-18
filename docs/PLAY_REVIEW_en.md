# Playthrough behavior and acceptance

This page describes RP playthroughs in the Tavern `2.3.0` candidate, targeting DSH
`0.1.5-rc.1`. The candidate is not merged or released. See [Trace acceptance](TRACE_REVIEW_en.md)
for current verification results and release gates. [中文](PLAY_REVIEW.md)

## Current behavior

| Area | Contract |
| --- | --- |
| History and input | DSH durable history is authoritative. Host operations use Tavern's public-controller adapter. Input uses `session.prompt({ mode: "queue" })`; timelines keep Session/event-range references. |
| Playthrough lifecycle | Create runs by character; reuse the latest run only when its Session is empty. Generated titles follow locale; custom titles stay verbatim. Runs with missing DSH logs remain visible with an error, do not block creation and are not reused as empty. |
| Greetings | The native composer dock displays blank-run greetings. Blank alternatives are skipped without renumbering card indices. Each boundary disables its arrow; an existing blank selection can recover to a valid greeting. |
| External records | Bind, replace or unbind records on the current empty root Session, revalidated by the server. The latest three QA pairs are display previews, not DSH history. Unbinding restores greetings. |
| One-time context | Assembly requires public `claimEventSeqs` before injection and persistent claiming. The same claim can replay before its terminal event; a new claim after terminal does not inject again. Tavern swipe/branch carries body-free lineage. |
| Replies and branches | Display overrides, existing variants, new swipes, branches and rollback are supported. Parent/head preserves each swipe's continuation. Retry after context-triggered output targets the last real user turn, never resubmits context as user input. |
| Display regex | Order is global→preset→character, with reordering within each source only. Rules affect RP display, not DSH originals. Hiding variable-update blocks does not require a variable runtime; that runtime itself is unsupported. |
| Rich text | Markdown, nested details, HTML and isolated CSS are supported. Complete HTML documents in closed unlabeled/html fences render as individually isolated static templates; ordinary code fragments remain literal. Template JavaScript, dangerous events and unsafe links are filtered; MVU and other variable APIs are not implemented. Static HTML exports use the same rendering boundary. |
| Views and errors | RP consumes the official Chat message projection and hides reasoning/context. Conversation owns phase and view selection. Native Chat retains diagnostics; RP shows a localized terminal-error notice. |
| Workspace admission | Missing bindings, invalid candidates and read failures block RP workspace content. Candidates come from public DSH workspaces, require selection and read-back verification, and are not duplicated in browser storage. Retry or return to native mode. |

## Consistency and security boundaries

- History pagination holds a stable official cut and continues to `hasMore: false`.
  Empty pages, invalid oldest seq or stalled cursors return `502 PLAY_HISTORY_CURSOR_STALLED`,
  not apparently complete partial history. DSH owns model context limits.
- Catalog/timeline reads and writes validate schema, unique IDs/paths, safe relative paths
  and known extensions while preserving third-party extensions. Managed PUT requires
  `expectedRevision`; SHA-256 revision/CAS conflicts return `409 PLAY_FILE_REVISION_CONFLICT`
  without changing files. Clients replay only pure local mutations, not Host side effects.
- Stable focus resolves a validated playthrough ID, using rootSessionId for blank runs.
  The explicit-path route is compatibility-only; `activeTimelinePath` is not focus authority.
- Target locks, per-segment path checks, exclusive temporary writes and pre-rename checks
  provide practical path protection. Pure Node does not promise cross-process/kernel
  no-follow transactions. Multi-resource lifecycle operations are not cross-file transactions.
- Lifecycle writes use Cordis `ctx.logger` for request-local operation IDs, stages, codes
  and duration without bodies. Clients recover through completed stages, read-back and
  stable errors. These logs are not a persistent audit journal.
- Imported context is marked untrusted. Greetings, imported QA, display overrides and
  timelines never fabricate DSH messages. Native Sessions/history remain usable after removal.

See [API](API_en.md), [usage](USAGE_en.md), [security](../SECURITY_en.md) and the
[coordinate migration guide](DSH_0.1.5_MIGRATION_en.md) for the corresponding contracts.

## Acceptance workflow

1. **Automated checks.** `npm run verify:2.0` covers history, schema/CAS/focus, path safety,
   claim/lineage, operation logs, services/slots, localization and packaging. Set
   `DSH_TAVERN_COMPAT_ROOT` for official codecs; a conditional skip is not a pass.
2. **Real Host reads.** Set `DSH_TAVERN_PLAY_LIVE=1` and `DSH_TAVERN_PLAY_LIVE_URL`, then run
   `node --test test/play-sessions.test.mjs`. This verifies chrome/workspace reads, not writes or UI behavior.
3. **Browser lifecycle.** Use copies to exercise workspace admission, create/reuse/rename,
   greeting boundaries, first send, streaming/completed output, regex/rich text, swipe
   continuations, branch/rollback, import rebinding and export. Reload a valid branch in
   a workspace with missing logs: RP must remain available and new runs must be creatable.
4. **Concurrency and failure.** Check focus/SSE/poll convergence and CAS conflicts across
   two tabs; cancellation, failure/retry, import claim terminal semantics and partial-operation
   read-back recovery. Third-party plugins require their own integration acceptance.
5. **Removal and recovery.** Remove/reinstall only in a test profile. Native Sessions must
   remain usable and external Tavern data retained. `--no-backup` skips a removal backup;
   it does not mean delete resources.

Release requires maintainer acceptance of this candidate and explicit authorization.
Earlier-version acceptance is not a substitute; consult matching Git tags for past records.

# Model history filtering: standard and advanced

[中文](HISTORY_POLICY.md)

The independent assembler history capability filters copies of a request through the existing protocol-1
assembly seam. Final messages, rule revisions and exact match ranges are recorded in `request/assembly`.
Original events, assistant streams, displayed transcripts and MVU audit evidence remain unchanged.
Standard mode uses stock public pre-step and surface replacements to clean old plugin users while retaining complete assistant replies, without the advanced core.

## Tavern contributions

`packages/history-policy/index.js` exports:

- `TAVERN_HISTORY_FRAGMENT_PRESETS`: a disabled-by-default MVU update fragment example.
- `mountTavernHistoryPolicyPanel(container, options)`: the shared editor with Tavern's example supplied.

The example targets assistant text with `sourceKind: model`, matching standalone `<UpdateVariable>` and
`</UpdateVariable>` lines starting at column zero. It removes the entire wrapper, including update analysis
and results, while preserving surrounding RP prose. It does not infer sources from generic `think` or
`Analysis` terms or match ordinary prose by default. Fenced examples, quoted inline examples, indented code,
nested markers and missing closing markers remain. Users may explicitly choose literal mode for inline
matching and inspect the preview first. Unknown historical sources are retained with diagnostics.

## Standard source cleanup

The same editor offers working source controls, preview and save. Exact `source.kind` identifies consumed
plugin injections. Human/model retention is locked; unknown sources stay with warnings. Content, reasoning
and MVU controls are disabled and labeled advanced-only. Existing advanced rules stay stored but are inactive;
the standard API rejects changes to those fields.

New sessions default to disabled. Saves apply on the next accepted pre-step; retries reuse the committed surface.
Current/unsent injections and the latest reused runtime-context stay. Old injections are replaced in place with
empty developer messages. Changing source rules or disabling restores still-live owned placeholders next step,
with original user IDs/content/order; compaction-shadowed placeholders never revive. Restart preserves settings.
New fork IDs default disabled and restore inherited placeholders on first run, unless explicitly given a copied policy.
Unloading leaves committed cleanup in place and stock sessions remain usable. To restore first, disable and run
a step, or let an authorized idle-session caller use the generic `applyStandardHistory` primitive. Original logs
and provenance references remain intact.

After two `preset, preset, human, preset, assistant` rounds, request three includes the earlier
`human, whole assistant, human, whole assistant` plus current presets and input. Identical human text is retained.

## Advanced settings and application

The panel controls retained sources and text/image/reasoning types, exact fragment rules, original/effective
content and removed ranges. New sessions default to disabled. Saves apply at the next advanced step;
retries within a step keep the captured revision. Disabling/unloading restores native effective history,
without undoing DSH compaction. Forked session IDs default to disabled and may explicitly copy a policy.

Current-step contributions, the latest native runtime context, system instructions, tool calls/results and
adapter replay data are protected. Verified DeepSeek Messages v1 replay supports text-only span edits with every block and signature retained; unknown replay formats remain unchanged. Reasoning is omitted only under a verified target-model contract;
otherwise it remains with a warning. UI hiding is not treated as provider omission, and reasoning removal
for DeepSeek requests carrying tools is not promised.

## Root integration

The integrator owns the following wiring; this directory leaves root entry points, layout modules and locks unchanged:

1. Share one HistoryPolicyStore across runtime, preview and API. Register `registerStandardHistoryPolicy` with the Host createDeveloperMessage factory, public inspect event reads and actual backend `active` selection. Also register `registerHistoryPolicy` when the advanced core is present. Keep the standard hook mounted on backend switches: active=false restores its placeholders before the next advanced request.
2. Mount `createHistoryPolicyHandler` inside the existing secured assembler router and reuse browser/desktop token transport. Cold previews reuse inspect + sessions.prepare and return native nodes/messages/complete events. Route to mode:standard/advanced services based on actual session backend, never client assertions.
3. Mount `await mountTavernHistoryPolicyPanel(container,{sessionId,request})` for either mode. Server capabilities control availability; dispose/remount on session/backend switch or unload. MVU examples are disabled in standard mode.
4. If package-level access is needed, export `./history-policy` as `./packages/history-policy/index.js`, then update dependency locks and generated client bundle through the existing workflow.
5. Trace/actual-request views must use `request/assembly.data.messages` for sent content and `metadata.historyPolicy` for policy evidence. Standard requests use the native surface at request time, with data.historyPolicy/sourceEventSeqs on built-in replacement events for provenance. Existing `metadata.assembly` layout nodes describe pre-filter content.

The generic API/contract lives in assembler `docs/HISTORY_POLICY.md`. Tavern neither copies the engine nor
creates another configuration store. Layout assembles first; the independent history policy filters afterward.

## Verification boundary

`DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs` uses the real generic engine to verify opt-in behavior, advanced MVU removal, complete standard assistant reasoning/MVU retention, identical human text retention and original-message preservation. It explicitly skips without that path.
Assembler `test/history-*.test.mjs` covers filtering, HTTP/UI and real Host modules with multi-turn requests,
retry, tools, restart, fork, compaction boundaries and stock continuation after uninstall. An isolated browser
page mounts the same editor for acceptance. Root wiring, combined layout-branch checks and actual target
adapter contracts remain integration responsibilities. No real profiles, paid model calls or token-saving
measurements are used.

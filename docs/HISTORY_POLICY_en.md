# Advanced model history filtering

[中文](HISTORY_POLICY.md)

The independent assembler history capability filters copies of a request through the existing protocol-1
assembly seam. Final messages, rule revisions and exact match ranges are recorded in `request/assembly`.
Original events, assistant streams, displayed transcripts and MVU audit evidence remain unchanged.
Standard mode retains its current behavior.

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

## Settings and application

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

1. Select an assembler version containing history support and register `registerHistoryPolicy` in the existing advanced Host service context. Share one HistoryPolicyStore across runtime, preview and API.
2. Mount `createHistoryPolicyHandler` inside the existing secured assembler router and reuse browser/desktop token transport. Cold previews reuse inspect + sessions.prepare and read native surface, not a previously filtered request.
3. For advanced sessions only, `await mountTavernHistoryPolicyPanel(container,{sessionId,request})`. Dispose on switch/unload. Do not mount these controls for standard mode.
4. If package-level access is needed, export `./history-policy` as `./packages/history-policy/index.js`, then update dependency locks and generated client bundle through the existing workflow.
5. Trace/actual-request views must use `request/assembly.data.messages` for sent content and `metadata.historyPolicy` for policy evidence. Existing `metadata.assembly` layout nodes describe pre-filter content.

The generic API/contract lives in assembler `docs/HISTORY_POLICY.md`. Tavern neither copies the engine nor
creates another configuration store. Layout assembles first; the independent history policy filters afterward.

## Verification boundary

`DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs` uses the real generic engine to verify opt-in behavior, MVU removal, identical human text retention and original-message preservation. It explicitly skips without that path.
Assembler `test/history-*.test.mjs` covers filtering, HTTP/UI and real Host modules with multi-turn requests,
retry, tools, restart, fork, compaction boundaries and stock continuation after uninstall. An isolated browser
page mounts the same editor for acceptance. Root wiring, combined layout-branch checks and actual target
adapter contracts remain integration responsibilities. No real profiles, paid model calls or token-saving
measurements are used.

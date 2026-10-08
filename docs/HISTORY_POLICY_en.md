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

## Installed entry points and usage

Open prompt assembly settings and expand “Model history filtering” in the current-session application area. Select retained sources, inspect matching previews, then save history rules. These rules belong to the session and are saved independently from assembly strategies. Switching a strategy preserves history settings. New sessions start disabled.

The assembler plugin mounts standard cleanup using one shared `HistoryPolicyStore`; the optional core plugin mounts advanced request filtering. The actually applied backend determines API capabilities and editor controls. Editing a strategy does not change those capabilities early. When switching to advanced mode, the standard hook first restores still-live owned placeholders before filtering the request copy.

History and assembly APIs share the existing security router and browser/desktop transport. Cold-session previews use public inspect and sessions.prepare without creating an Agent. Tavern supplies the MVU example and embedding, without copying the generic engine or settings store. The `./history-policy` package export provides the Tavern example and mounting function.

Actual requests use the recorded final messages. Advanced result cards reconcile history text using `metadata.historyPolicy`, while original layout and event audit remain intact. Standard provenance uses built-in replacement events and `data.historyPolicy/sourceEventSeqs`. Layout assembly precedes history filtering.

## Verification boundary

`DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs` uses the real generic engine to verify opt-in behavior, advanced MVU removal, complete standard assistant reasoning/MVU retention, identical human text retention and original-message preservation. It explicitly skips without that path.
Assembler `test/history-*.test.mjs` covers filtering, HTTP/UI and real Host modules with multi-turn requests,
retry, tools, restart, fork, compaction boundaries and stock continuation after uninstall. An isolated browser
page mounts the same editor for acceptance. Combined Host tests cover installed entry points, backend switching and the shared security boundary. Offline checks do not establish remote adapter acceptance or token savings; no paid model calls are required.

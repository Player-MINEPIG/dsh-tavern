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
Current/unsent injections stay. Excluded runtime context is refreshed into this step before its old copy is removed. Old injections are replaced in place with
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

Current-step contributions, the current system prompt, developer instructions, tool calls/results and
adapter replay data are protected. Verified DeepSeek Messages v1 replay supports text-only span edits with every block and signature retained; unknown replay formats remain unchanged. Reasoning is omitted only under a verified target-model contract;
otherwise it remains with a warning. UI hiding is not treated as provider omission, and reasoning removal
for DeepSeek requests carrying tools is not promised.

## Installed entry points and usage

Open “History filtering rules and preview” directly below “Assembly rules and preview”. Both sections share collapsible highlighted headings and rules/preview tabs. Select sources and inspect the preview, then use “Save rules” to save the complete preset. “Apply to this session” changes the active snapshot. Save as, import/export, opening drafts and applied snapshots carry the optional `historyPolicy` field. Saving a library preset does not change already-applied sessions.

Preview backgrounds are red for removed text, blue for retained text and green for additions (restoring messages previously hidden by this feature). Fragment edits mark retained and removed ranges in the original text. Green does not mean generated content. Preview does not mutate logs or sessions. Policies can be edited before a session exists; history previews become available after creation.

Presets without `historyPolicy` retain the legacy session policy at runtime. The editor loads and identifies that fallback, capturing it into the preset on the next save. Existing resources are not rewritten in bulk. Unconfigured policies default to disabled. Standard and optional core hooks read the applied strategy snapshot. Editor controls and read-only previews follow the draft backend; execution and direct session APIs follow the applied backend. Switching to advanced mode restores live standard placeholders before filtering the request copy.

History and assembly APIs share the existing security router and browser/desktop transport. Cold-session previews use public inspect and sessions.prepare without creating an Agent. Tavern supplies the MVU example and embedding, without copying the generic engine or settings store. The `./history-policy` package export provides the Tavern example and mounting function.

Actual requests use the recorded final messages. Advanced result cards reconcile history text using `metadata.historyPolicy`, while original layout and event audit remain intact. Standard provenance uses built-in replacement events and `data.historyPolicy/sourceEventSeqs`. Layout assembly precedes history filtering.

All preview rows start collapsed. The effective native message list includes saved `system/message` events. Separate `system-prompt` (system history) and `runtime-context` (runtime context history) controls select retention. Unchecking marks old copies red, including the latest old runtime snapshot: required runtime context is supplied once as a current-step message, and DSH reconciles old system revisions into the current effective prompt. Preview excludes future step contributions; red history rows do not mean current instructions/context stop being sent. Tool transactions and developer instructions remain protected. Older policies without a system-prompt rule retain their behavior; new default policies include this exclusion but filtering itself defaults off.

## Verification boundary

`DSH_HISTORY_ASSEMBLER_ROOT=/path/to/assembler node --test test/history-policy-mvu.test.mjs` uses the real generic engine to verify opt-in behavior, advanced MVU removal, complete standard assistant reasoning/MVU retention, identical human text retention and original-message preservation. It explicitly skips without that path.
Assembler `test/history-*.test.mjs` covers filtering, HTTP/UI and real Host modules with multi-turn requests,
retry, tools, restart, fork, compaction boundaries and stock continuation after uninstall. An isolated browser
page mounts the same editor for acceptance. Combined Host tests cover installed entry points, backend switching and the shared security boundary. Offline checks do not establish remote adapter acceptance or token savings; no paid model calls are required.

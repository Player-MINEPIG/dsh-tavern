# Model history filtering integration boundary

[中文](HISTORY_POLICY.md)

Complete history filtering is not integrated on DSH `0.2.0-rc.2`. Displayed text, original audit history
and model-visible history may differ, but edits must preserve remaining per-message roles and order,
and native sessions must remain usable after Tavern/assembler removal.

Assembler maintains the generic reproduction in `test/history-native-capabilities.test.mjs` and
`docs/HISTORY_POLICY.md`. An empty native system replacement can hide an old user injection.
Assistant replacements encounter conflicting validation with and without source references.
Custom projections can edit assistant content, but removing a used interpreter blocks reads and
future writes. That mechanism cannot ship as an uninstall-compatible Tavern feature.

## Tavern-specific constraints

- Recognize human input only through trustworthy `source.kind: user` and producer contracts.
  User role alone does not classify preset/worldbook/PHI or tool injections as human. Preserve unknown sources and explain the fallback.
- History policy must be independent of request layout and identity adaptation. Retaining old injections must not affect assembly of resources needed for the current step.
- MVU update spans are structure inside assistant text, distinct from provider reasoning. Future rules should explicitly select known MVU structure and preview boundaries and retained text. Generic words such as `think` or `Analysis` must not remove ordinary RP prose by default. Quoted examples, missing closing markers, nesting and ambiguous matches need explicit retention behavior.
- Span removal must preserve displayed originals and MVU audit evidence. Keep tool calls paired with their results. Reasoning removal depends on the actual provider/adapter contract.
- Retroactive rule application, disabling/restoration and fork/compaction coordinate boundaries need native replayable decisions. Current settings alone cannot explain historical requests.

## Prerequisite for integration

Native durable hiding/content editing and undo must preserve original model streams, source attribution
and message identity, and replay without the plugin. A single user checkpoint, fabricated assistant stream
or undeclared cross-role event payload cannot bypass this contract. No `packages/history-policy/`
runtime, setting, API or client registration is supplied; there is no hidden switch to enable.

Once that capability exists, generic rules, persisted settings and embeddable UI belong in assembler.
Tavern should supply only MVU/resource recognition and settings integration. Differences between original
and effective history must be reconstructable per request and verified before root registration.

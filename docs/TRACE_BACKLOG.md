# Trace / API v3 implementation backlog

Status: planned, 2026-09-16. Target Host: DSH `dsh-v0.1.5-rc.1`.
Branch: `codex/trace-api-v3`, based on main. This replaces the unpublished
composer-oriented v3 candidate; it does not merge that candidate's ownership API.

## Accepted boundaries

- Use “提示词装配 / prompt assembly”; program builds are a separate operation.
- Preserve existing preset order, markers, overrides, macros, fallback placement,
  and rendered text while contributing named official system sections.
- Keep mixed-source text within a section where splitting would add whitespace.
  Record source relationships during assembly, never infer them from final prose.
- Provide small public primitives for current sources and historical assembly
  records. No composer registry, owner arbitration, or prescribed workflow.
- Third parties may use either Tavern APIs or official DSH assembly seams.
- Capture at runtime, retain bounded immutable assembly facts for historical
  queries, correlate turn / step / attempt with the actual LLM boundary.
  DSH durable history remains authoritative; Trace never enters model history.
- Tavern Trace consumes the same public v3 contract as third-party frontends.
- Current resource state and historical request facts must never be conflated.
- Agent-preset creation (#5) and playthrough deletion (#6) remain separate work.

## Delivery stages

- [ ] 1. Document contract and inspect pinned Host interfaces; prepare 0.1.5 runtime.
- [ ] 2. Source-aware ordered assembly and official named-section adapter.
- [ ] 3. Bounded persistent Trace records, request correlation and minimal v3 APIs.
- [ ] 4. Trace UI with lazy record detail, source/content inspection and live refresh.
- [ ] 5. Unit, HTTP, regression and real 0.1.5 Host/service acceptance; build and pack.
- [ ] 6. Bilingual API/design/migration examples and manual acceptance checklist.
- [ ] 7. Upgrade local default DSH to 0.1.5-rc.1 and verify launcher/profile compatibility.
- [ ] 8. Review, commit and deliver candidate branch/package; no merge/tag/release.

## Required regression cases

Preset/character interleaving; main/jailbreak with repeated original references;
field macros; fallback and lore budget; empty fragments and Unicode; current vs
historical edits; retries and multiple steps; post-waterfall changes and complete
sections; missing provenance; retention/oversize/corrupt storage; no private
storage paths or credentials in public responses; source data rendered as text;
v1/v2 compatibility; official-only observer; third-party source API consumer;
native DSH behavior after Tavern unload.

## Evidence

Pending implementation. Automated checks and manually unverified cases will be
recorded separately. Local environment details remain outside this repository.

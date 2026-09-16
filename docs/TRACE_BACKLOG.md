# Trace / API v3 implementation backlog

Status: implemented and validated, 2026-09-16; maintainer acceptance pending. Target Host: DSH `dsh-v0.1.5-rc.1`.
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

- [x] 1. Document contract and inspect pinned Host interfaces; prepare 0.1.5 runtime.
- [x] 2. Source-aware ordered assembly and official named-section adapter.
- [x] 3. Bounded persistent Trace records, request correlation and minimal v3 APIs.
- [x] 4. Trace UI with lazy record detail, source/content inspection and live refresh.
- [x] 5. Unit, HTTP, regression and real 0.1.5 Host/service acceptance; build and pack.
- [x] 6. Bilingual API/design/migration examples and manual acceptance checklist.
- [x] 7. Upgrade local default DSH to 0.1.5-rc.1 and verify launcher/profile compatibility.
- [x] 8. Review, commit and deliver candidate branch/package; no merge/tag/release.

## Required regression cases

Preset/character interleaving; main/jailbreak with repeated original references;
field macros; fallback and lore budget; empty fragments and Unicode; current vs
historical edits; retries and multiple steps; post-waterfall changes and complete
sections; missing provenance; retention/oversize/corrupt storage; no private
storage paths or credentials in public responses; source data rendered as text;
v1/v2 compatibility; official-only observer; third-party source API consumer;
native DSH behavior after Tavern unload.

## Evidence

Full tests: 552 pass / 0 fail / 2 optional skips; real pinned AgentLoop and official
codecs enabled. Separate live v2 smoke: 16/16. Build, verify:2.0, package boundaries,
public links and 202 installed files checked. Real Web UI, synthetic requests,
source inspection, restart and immutable historical reads exercised. See
[acceptance and remaining manual checks](TRACE_REVIEW.md). Local environment
coordinates, auth tokens and synthetic profile remain outside the repository.

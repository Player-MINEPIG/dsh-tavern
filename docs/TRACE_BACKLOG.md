# Trace / API v3 implementation backlog

Status: implemented and validated, 2026-09-18; complete maintainer checklist pending. Target Host: DSH `dsh-v0.1.5-rc.1`.
Branch: `codex/trace-api-v3`, based on main. This replaces the unpublished
composer-oriented v3 candidate; it does not merge that candidate's ownership API.

## Accepted boundaries

- Use “提示词装配 / prompt assembly”; program builds are a separate operation.
- Preserve existing preset order, markers, overrides, macros, fallback placement,
  and rendered text while contributing named official system sections.
- Keep mixed-source text within a section where splitting would add whitespace.
  Record source relationships during assembly, never infer them from final prose.
- Keep current resources/configuration in v1; provide small v3 primitives for
  per-request assembly records and provenance. No composer registry, owner arbitration, or prescribed workflow.
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

Latest pre-release full tests: 578 pass / 0 fail / 2 optional skips; real pinned AgentLoop and official
codecs enabled. Separate live v2 smoke: 16/16. Build, verify:2.0, package boundaries,
public links and 202 installed files checked. Real Web UI, synthetic requests,
source inspection, restart and immutable historical reads exercised. Latest browser
rich-text fixture: 19/19. Independent-store eviction and equal-clock capture identity
regressions pass. See
[acceptance and remaining manual checks](TRACE_REVIEW.md). Local environment
coordinates, auth tokens and synthetic profile remain outside the repository.

## API scope audit — 2026-09-17

Documentation-only follow-up: v1/v2/v3 endpoint catalogs now use the v2 table format.
Current v3 `/sources` overlaps v1 resource/configuration responsibilities. Its
aggregate counts/revision and no-assembly read differ from v1 `/active`; the APIs
are not response-equivalent. Historical v1 audit and v3 selection/audit intentionally
overlap for compatibility. Named historical sections/provenance/request verification
remain the independent v3 contribution. See [scope audit](API.md#api-scope).

## API scope implementation — 2026-09-18

- [x] Remove the candidate current `/sources` aggregator and its service, wiring,
  capabilities and example fields. GET returns 404. Update bilingual documents and
  regression tests; retain historical `sections[].sources` and their counts.
- [x] Document ordered manual acceptance steps and expected results.

## Pre-release retention follow-up — 2026-09-18

- [x] Clarify that all sessions share the byte/count budget and that eviction loses
  provenance even though official DSH history remains intact. Existing byte settings
  have hard ceilings; they do not provide permanent archival retention.
- [ ] Proposed follow-up, not implemented in this candidate: configurable retention
  policy and visible retained range; per-record storage for longer history without
  rewriting the complete JSON document on each capture. Set defaults and migration
  behavior explicitly before implementation.

- [ ] Proposed follow-up, not implemented: resolve verified request text from official
  versioned Session messages, retaining Tavern provenance metadata separately. Define
  missing-history, migration and unmatched-assembly behavior; historical pre-expansion
  source text still requires versioned snapshots if it remains part of the contract.

## Accepted correction — official history references, 2026-09-18

The maintainer approved this change before release. It supersedes the original
per-request body snapshots and the two proposed storage follow-ups above.

- [x] Remove Tavern-generated identity headers and XML wrappers from both prompt
  assembly paths. Preserve author content, semantic import boundaries, official
  section names, macro expansion and order. Requested ST roles remain metadata;
  this does not implement new message-role/depth placement.
- [x] Capture only configuration, lore decisions, provenance identifiers/counts/
  fingerprints and verified references to official versioned Session events.
  Do not persist source originals, rendered sections, contexts or system-message
  copies for new captures, including failures and unmatched requests.
- [x] Make v1 audit and v3 views share one canonical metadata record for new captures;
  retain read compatibility for previous v1 metadata and v3 body snapshots.
- [x] Resolve detail bodies through cold official Session inspection. Check session
  identity, format version, captured cut, event/message identity, range and hash.
  Missing/mismatched history yields explicit unavailable states, never a new
  assembly, guessed relocation or text fallback. Keep three read-only v3 routes.
- [x] Preserve configuration-first Trace with separate lore/Loader disclosures;
  explain originals not stored and referenced bodies unavailable.
- [x] Cover replacement/reuse, inheritance, retry, restart, missing/corrupt/changed
  history, metadata retention, large-card size independence and legacy snapshots.
  Validate real DSH 0.1.5-rc.1, synchronize bilingual contracts and install the
  final candidate in the authorized test environment. Push branch only; no release.

Execution evidence and the remaining maintainer checklist are recorded in
[TRACE_REVIEW.md](TRACE_REVIEW.md). Existing running Hosts must restart to load the new backend.

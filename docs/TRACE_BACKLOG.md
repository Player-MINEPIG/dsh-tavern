# Trace / API v3 backlog

Candidate: Tavern `2.3.0`; target Host: DSH `0.1.5-rc.1`. Trace implementation and automated,
Host and Chrome checks are complete within the documented scope. Verification limits and
remaining external checks are listed below. No merge, tag or release.

## Current scope

- Official named sections preserve preset order and author text. Source identities
  stay in metadata, outside model text; requested ST roles do not change actual DSH
  message roles or implement arbitrary depth placement.
- v3 provides capabilities, an assembly index and one-record detail reads. Current
  resources/bindings/configuration are v1 responsibilities. There is no `/sources`
  aggregate, composer registry or exclusive external owner.
- New schema-4 captures store configuration, lore decisions, provenance/counts/hashes
  and verified official event references in one canonical record shared by v1/v3.
  No new source-original, section, context or system-message body copies are persisted.
- Detail reads use cold official Session inspection, verify identity/version/cut/event/
  message/range/hash and return explicit unavailable states on failure. They never
  reassemble current resources, guess relocated coordinates or use a body-copy fallback.
- Existing v1 metadata and schema-3 body snapshots remain readable without rewriting
  their files. New retention is shared across Sessions: at most 256 records and the configured byte
  ceiling, not a guaranteed number of turns per Session. The count policy is fixed. It does not remove
  DSH history or provide permanent provenance archival.
- Trace leads with the captured configuration, with separate lore and Loader disclosures.
  Source originals are marked not stored; missing referenced bodies are explained.

## Delivery status

- [x] Empty character nicknames fall back to the card name in every loader macro context.
- [x] World-book sources distinguish the v1-compatible entry UID from the qualified loader ID.
- [x] Trace details expose verified official failure information without storing error-body copies or adding RP messages.
- [x] Storage-location tests use platform-absolute fixtures; runtime and API contracts revalidated on macOS.

- [x] Official section contributions and source metadata.
- [x] Minimal v3 routes and compatible v1 shared audit view.
- [x] Verified official-history references, cold detail reads and old-file compatibility.
- [x] Configuration-first UI with explicit partial/missing-body states.
- [x] Unicode, reuse/replacement, inheritance, retries, restart, format/hash/range errors,
  size limits, large-card storage independence and legacy audit regressions.
- [x] DSH 0.1.5-rc.1 Host verification, build, package and bilingual contracts.
- [x] Chrome verification of two real cards without cross-session content, configuration-first Trace, lore decisions and interleaved official sections.
- [x] Chrome window sizes, Tavern scaling, Chinese/English, DSH themes and native/Mowan switching; settings restored afterward.
- [x] Complete HTML fences render as separate RP Shadow DOM panels: four real-card documents and 32 synthetic Chrome checks passed, including static HTML export. Variable-update markers remain hidden; JavaScript/MVU-dependent values and buttons remain unsupported.
- [x] An ordinary real-model reply and Stop generation recovery. The stopped request retains 31/31 readable sections without fabricated success/failure. Official durable history lacks its turn/end; cold reading supplies an in-memory interrupted closer, not a persisted user-cancellation reason.

## Remaining external checks

- [ ] Maintainer presentation review of the final RP/Trace experience, without repeating the completed technical matrix.
- [ ] Actual third-party plugin integration through v3 or official assembly interfaces.
- [ ] Native Windows storage-path and installation checks.

Real-provider timeout/retry was not deliberately induced. Seven real-AgentLoop synthetic failure
scenarios cover attribution and verified failure reads; they do not certify a specific provider
or the actual third-party plugin. The remaining release decision follows the checks above.

See [current evidence, remaining checks and optional reproduction](TRACE_REVIEW_en.md).
Completed technical checks do not need to be repeated solely for manual sign-off.

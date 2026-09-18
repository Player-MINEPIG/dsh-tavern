# Trace / API v3 backlog

Candidate: Tavern `2.3.0`; target Host: DSH `0.1.5-rc.1`. Implementation and automated
acceptance are complete. Maintainer acceptance remains open; no merge, tag or release.

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

- [x] Official section contributions and source metadata.
- [x] Minimal v3 routes and compatible v1 shared audit view.
- [x] Verified official-history references, cold detail reads and old-file compatibility.
- [x] Configuration-first UI with explicit partial/missing-body states.
- [x] Unicode, reuse/replacement, inheritance, retries, restart, format/hash/range errors,
  size limits, large-card storage independence and legacy audit regressions.
- [x] DSH 0.1.5-rc.1 Host/browser acceptance, build, package and bilingual contracts.
- [ ] Maintainer review of representative card/preset behavior and RP presentation.
- [ ] Third-party developer validation using both v3 and official assembly interfaces.
- [ ] Real-model cancellation, timeout and retry acceptance; release decision afterward.

See [the current evidence and manual checklist](TRACE_REVIEW_en.md). These are the
remaining candidate gates, not a commitment to unrelated API or storage expansion.

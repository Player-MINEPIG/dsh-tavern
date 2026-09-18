# Trace / API v3 backlog

Version: Tavern `2.3.0`; target Host: DSH `0.1.5-rc.1`. Implementation, automated, Host and Chrome
checks and maintainer presentation review are complete within the documented scope. Content review
is pending; merge into `main` follows approval. No merge, tag or release has taken place.

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

## Current acceptance

Implementation and target-runtime verification are complete for the documented scope, including
configuration-first Trace, official-history references, failure attribution, static HTML rendering,
and workspace diagnostics. Maintainer presentation review is complete. The single current result,
validation limits and optional reproduction steps are in [Trace acceptance](TRACE_REVIEW_en.md).
Completed technical checks do not need to be repeated solely for content review.

## Remaining work

- [ ] Maintainer content review of documentation, the release announcement and separate issue replies.
- [ ] Merge into `main` as `2.3.0` after content approval; tag/release publication and issue posting
      require their own authorization.

## Remaining external verification

- [ ] Actual third-party plugin integration through v3 or official assembly interfaces.
- [ ] Native Windows storage-path and installation checks.

Real-provider timeout/retry was not deliberately induced. Seven real-AgentLoop synthetic failure
scenarios cover attribution and verified failure reads; they do not certify a specific provider
or the actual third-party plugin.

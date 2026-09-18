# Trace candidate acceptance

Current candidate: Tavern **2.3.0**, targeting DSH **0.1.5-rc.1**, on `codex/trace-api-v3`.
Trace implementation, automated regressions, Host and Chrome checks are complete within the scope below.
Remaining external checks are presentation review, actual third-party integration and Windows verification;
verification limits are stated below. No merge, tag or release.
[中文](TRACE_REVIEW.md) · [API and design contract](PROMPT_API_V3_en.md) · [Playthrough acceptance](PLAY_REVIEW_en.md)

## Current delivery

| Requirement | Implementation |
| --- | --- |
| Preset-ordered assembly and provenance | Official named sections retain order, macros and mixed input relationships. Generated identity wrappers stay out of model text; author-written labels remain. |
| Minimal v3 primitives | Three read-only endpoints: capabilities, assembly index and detail. v1 owns current resources/configuration; v2 owns RP workflow primitives. |
| Per-request history | Capture turn/step/attempt, configuration, lore decisions, provenance and official references. New v1/v3 views share a schema-4 record. |
| No duplicate prompt bodies | New records do not store system-message, section, context or original-source bodies. Detail reads cold-inspect official history and verify identity, format, cut, event, hash and range. |
| Explicit missing data and compatibility | Missing/mismatched history is unavailable. Old v1 metadata and schema-3 snapshots remain read-only, are not automatically removed and never provide a body fallback for new records. |
| Clear UI and third-party composition | Trace leads with captured configuration and separate lore/Loader disclosures. Developers can choose v3 or official assembly/request interfaces. |

## Completed verification

Environment: Node.js 22.23.1, with the official CLI and resolved core packages pinned to
`0.1.5-rc.1`. These results apply to the current implementation.

- `npm run check`: 625 tests, 623 passed, 0 failed, 2 conditional skips. Real AgentLoop and
  official codecs were enabled. The private-card fixture and opt-in live v2 test skipped;
  the latter was exercised separately against a real Host.
- `npm run verify:2.0`, build and the 204-file package checks passed. Real-Host v2 smoke passed 16/16.
- Regressions cover interleaved sections, macros/mixed sources, Unicode, retry/multi-step,
  restart, message reuse/replacement, inherited prefixes, format changes, truncated/missing
  history, hash/identity/range failures, unknown provenance, complete overrides, limits and corruption.
- Storage tests verify large-card body growth does not proportionally grow Trace records,
  shared v1/v3 metadata, first attempt 1, finalized old v1 audit precedence and unchanged old files.
- Empty/whitespace-only nicknames on new/imported cards fall back to the card name. Lore sources
  retain separate in-book UIDs and qualified Loader IDs; old records remain unchanged. Path tests
  now use platform-native absolute fixtures; this run did not execute on a Windows host.
- Seven real rc.1 AgentLoop failure cases passed: provider failure, successful retry, LLM middleware
  failure, initial assembly failure, request preparation failure, retry preparation failure and next-step
  assembly failure. Failures belong to the correct attempt. Index/store data contain no error-body copies;
  details read independent official event references, report unavailable on missing/mismatched history,
  and do not add RP messages.
- An isolated Web Host verified normal assembly, provider failure and assembly failure through HTTP.
  After a real stop/restart, the same bodies and failure reasons remained readable before attaching
  the target Session/Agent. Reads neither activated the Session nor changed the Trace file;
  v2 still contained only successfully produced assistant messages.
- A real Host with a synthetic model resolved 23 sections and 2 Tavern inputs for a preset-bearing turn.
  After removing the request fixture and restarting, the same record resolved without reassembly.
  Two sample records occupied about 34 KiB; this is not a fixed retention estimate.
- Chrome checked the candidate on port `18977`, including switching between two real cards without
  cross-session content. Configuration-first Trace, included/rejected lore decisions, interleaved Loader
  sections and official-body verification were inspected. Source non-storage and requested ST role labels
  are visible. Trace displays prompt text literally, without executing HTML; actual model text contains no generated identity wrappers.
- Chrome checks covered `1024×768` and `1280×900` windows, Tavern 125% scaling, Chinese/English, DSH
  light/dark/system themes and native/Mowan switching. Chinese, 100% scaling and system theme were restored afterward.
- Complete HTML fences no longer appear as source in RP. Chrome verified four complete documents from a
  real card rendered as separate Shadow DOM panels, with static titles, theme colors and backgrounds visible;
  variable-update markers remain hidden from RP. Another 32 synthetic Chrome checks passed, covering complete
  document fences, root CSS variables, byte-preserved gradient shorthand and CSS imports, document style
  isolation, script filtering, streaming closure and actual `staticHtmlExport`. This does not implement
  dynamic values or buttons that depend on JavaScript/MVU.
- The configured model completed an ordinary reply. Stop generation restored the Send control. Read-only
  inspection verified 31/31 referenced sections for that request without fabricated success or failure.
  Its durable official history stops at `step/end` without `turn/end`; official cold reading adds only an
  in-memory `interrupted` closer. This does not establish that a user-cancellation reason was persisted.
  v3 invents no `failure` without official failure information. History and Trace files remained unchanged.
- CSSPeeper inspector / FileSaver unload console warnings came from the browser extension, not Tavern.
  Three 404 responses were explicitly `PLAY_SESSION_NOT_FOUND` for missing old logs. The UI explained
  them without blocking valid RP sessions.
- Installed test-environment files matched the package byte-for-byte, with consistent resolved core versions.
  An already running Host must restart after installation to load the new backend.

For reproduction, point each variable to a dependency directory containing `package.json`
that resolves its target modules. An installed CLI usually supports one shared root. Source
checkouts may need different roots: `DSH_TAVERN_COMPAT_ROOT` resolves session format/catalog/
migration packages and the session controller; `DSH_TAVERN_PROMPT_COMPAT_ROOT` resolves Cordis,
SystemPrompt, AgentLoop and related Host packages. Tests do not automatically search apps/cli
or other workspace directories.

```sh
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run check
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run verify:2.0
```

Without these variables the relevant integration tests skip, which is not acceptance. The reproducible
real AgentLoop paths are `test/trace-v3-host.test.mjs` and `test/trace-failures-host.test.mjs`. Real-model/card
checks above are separate browser evidence. Synthetic failures do not establish real-provider timeout/retry
behavior or acceptance of the actual third-party plugin.

## Remaining external checks

Maintainers do not need to repeat the completed API, Host and Chrome checklist. Remaining scope:

1. **Presentation review.** Decide whether RP rich text, Trace information hierarchy and interaction fit the intended experience. The completed HTML, window, theme, language and session-switching technical checks need not be repeated.
2. **Actual third-party integration.** The plugin developer should connect their own UI/workflow through the [v3 reader](examples/trace-reader.mjs) or [official observer](examples/official-prompt-observer.mjs), checking provenance display, plugin ordering and sampling policy. Official observation/reordering/replacement/complete overrides have passed with synthetic plugins; that does not certify the actual third-party plugin.
3. **Windows verification.** Portable path fixtures are fixed, but no Windows host was tested. Run storage-path and installation checks on Windows.

When reporting a failure, include the environment, steps and expected/actual behavior, adding Session ID, turn/step/attempt and recordId when needed. Keep private prompt bodies out of public reports.

## Optional reproduction

After changing the build/environment or finding a new problem, [install the candidate](INSTALLATION_en.md), restart the Host and use the commands above. These focused entry points are not another mandatory manual checklist:

- **API and configuration:** capabilities returns 200 and old `/sessions/:id/sources` returns 404. Read current bindings through v1 `POST /session-configurations/preview`, and history through v3 index/detail. Configuration queries should not create historical records; `/active` runs assembly and cannot verify that property.
- **Assembly and references:** compare ordering, separators and verification with official system text. Sources describe section-level input relationships, not character spans. Join lore by `resourceId + entryId`; `qualifiedEntryId` retains the complete Loader ID. Old details continue to depend on old official logs after resource edits. Moving a log aside in a disposable copy must make bodies explicitly unavailable without reconstruction.
- **Failures and migration:** when official history contains a failure reason, v3 details resolve `failureStatus` and `failure` through references, without an RP assistant-error message. Follow the [migration guide](DSH_0.1.5_MIGRATION_en.md) for old playthrough coordinates; verify removal fallback only in a test profile.

## Current limits

Trace is bounded recent-history metadata: all Sessions share defaults of 256 new records, 16 MiB total
and 2 MiB per record. Evicted provenance cannot be fully rebuilt from official messages; eviction never
deletes DSH history. Bodies require retained, verifiable logs. Names/keywords in metadata can still be sensitive.
Sources identify section inputs, not character-level maps. Requested ST roles remain metadata; contributions
are currently system sections. Arbitrary message depth, exclusive takeover and permanent archival are unsupported.
Source originals are not duplicated; use v1 for current resources.

RP HTML panels support filtered static HTML/CSS. Scripts do not execute; dynamic values and buttons that
depend on JavaScript/MVU remain unsupported. Trace continues to display prompt text literally without executing HTML.

Real-provider timeouts and retries were not deliberately induced. The seven real-AgentLoop synthetic
failure cases above cover failure attribution, not end-to-end failure acceptance for that provider.
Maintainers are not asked to repeat all completed checks.

One Host writes a store; multi-process writes are unsupported. Cold inspect uses logical event coordinates,
not O(1) random access into compressed logs. Retained older DSH paths do not extend this candidate's target-runtime
evidence. Merge and release require maintainer acceptance.

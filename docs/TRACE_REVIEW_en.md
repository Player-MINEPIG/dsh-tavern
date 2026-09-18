# Trace candidate acceptance

Current candidate: Tavern **2.3.0**, targeting DSH **0.1.5-rc.1**, on `codex/trace-api-v3`.
Implementation, self-verification and test-environment installation are complete. The maintainer checklist
below is not fully signed off. No merge, tag or release.
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

- `npm run check`: 617 tests, 615 passed, 0 failed, 2 conditional skips. Real AgentLoop and
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
- Browser checks verified configuration first, both disclosures, official body retrieval,
  source-original non-storage and requested ST role labels, with no warnings/errors. Section text
  is displayed literally, not executed as HTML. Actual model text contains no generated identity wrappers.
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
real AgentLoop paths are `test/trace-v3-host.test.mjs` and `test/trace-failures-host.test.mjs`. Synthetic models/fixtures do not establish
acceptance for real models, private cards or third-party plugins.

## Maintainer manual checks

Use a test profile and resource copies. Record pass/fail for each step. For failures,
include Session ID, turn/step/attempt, recordId, plugin ordering and expected/actual
behavior; avoid submitting private prompt bodies.

1. **Prepare the candidate.** Check out the latest `codex/trace-api-v3` commit,
   [install](INSTALLATION_en.md) into the test profile and restart the Host. Verify
   Tavern 2.3.0 candidate and `dsh --version` 0.1.5-rc.1. Upgrading CLI alone does
   not install this candidate into that profile. Check native Sessions and plugin loading.
2. **Verify API boundaries.** Run the same-origin console snippet below. Expect
   capabilities 200 without `currentSources/maxSourceBytes`, former `/sources` 404
   `NOT_FOUND`, and assembly index 200 (empty is valid). For current bindings use v1
   `POST /session-configurations/preview` with
   `{ "source": { "mode": "current", "sessionId": "your-session-id" } }`, then
   read resource details by returned IDs. Expect no new assembly or consumed greeting.
   Do not use `/active` to check absence of assembly: it runs assembly.
3. **Exercise a real preset/card for two turns.** Copy a complex preset/card/user/lore
   setup. Put distinctive text, including CJK and emoji, in preset blocks, character
   description and a lore entry. Place a character marker between preset entries,
   select an alternate greeting, and trigger lore on the first turn; send a second.
   Open Tavern Trace alongside Conversation/Trajectory and expand each turn's sections
   and inputs. Expect preset ordering, interleaved character/lore, identifiable mixed
   `{{original}}` inputs, first-turn greeting semantics and code-point counts (not tokens).
   Compare text and separators with official system text. Unmodified assembly should
   verify; source inputs are not character-by-character maps. Tavern-generated `<st-prompt>` or card-ID wrappers
   should be absent (author-authored labels remain). Input details show identity/counts/hashes and explain that
   original text was not stored; do not expect historical source.text for new records.
   Check that `{{char}}` resolves to the card name for an empty nickname. New lore sources expose
   the in-book UID as `entryId` and the full Loader ID as `qualifiedEntryId`. Also match `resourceId`
   when joining v1 audit data, respecting the API contract's clipping and duplicate-UID limits.
4. **Preserve history across edits/restart.** Save the first recordId/detail response,
   edit the card/preset and send another turn. Expect new content only in the new
   record, with unchanged old text/bindings/input metadata while official history remains available and verifiable. Restart and read the old record
   before activating the Session. In a disposable copy, move the official log aside: bodies must become explicitly
   unavailable while metadata remains readable; restore the log and read again. Switch Sessions and toggle Trace rapidly; expect
   no stale responses or content from another Session.
5. **Integrate the third-party plugin.** Ask its developer to use both the
   [v3 reader](examples/trace-reader.mjs) and [official observer](examples/official-prompt-observer.mjs).
   First observe, then reorder/replace one named section and contribute a new section
   through official assembly. Official APIs alone should operate on sections; v3
   adds detailed input provenance. Changed and unattributed sections should be unknown,
   not falsely inherit old provenance. Agree on plugin ordering and sampling settings.
   If using `complete`, expect failed assembly verification rather than a false match.
6. **Exercise real model outcomes.** Test ordinary replies, multi-step tools,
   cancellation, timeout and retries. Compare turn/step/attempt against official
   trajectories; separate attempts must not overwrite each other. `request-observed`
   proves LLM-boundary entry, not successful completion. Missing requests/bodies and
   failures must remain explicit. Confirm actual retries/steps from the official trace.
   When official history contains failure information, v3 details should return
   `failureStatus: "available"` and `failure.code/message`. A failed attempt remains readable after
   a successful retry. RP must not add a failed assistant message; RP messages alone do not show every failure.
7. **Check daily UI and upgrade compatibility.** Test window widths, themes, zoom,
   both languages, native/play switching, existing Sessions, plugins and model connections.
   Follow the [migration guide](DSH_0.1.5_MIGRATION_en.md) for old timeline coordinates;
   the CLI upgrade does not rewrite them. If testing removal, use only the test profile:
   native Sessions/history should remain usable without Tavern.

Run in an authenticated same-origin Host page (replace the ID, do not enter tokens):

```js
const sessionId = 'your-session-id';
const base = '/pmp-dsh-tavern/api/v3';
for (const path of [
  '/capabilities',
  `/sessions/${encodeURIComponent(sessionId)}/sources`,
  `/sessions/${encodeURIComponent(sessionId)}/assemblies`,
]) {
  const response = await fetch(base + path, { credentials: 'same-origin', cache: 'no-store' });
  console.log(path, response.status, await response.json());
}
```

## Current limits

Trace is bounded recent-history metadata: all Sessions share defaults of 256 new records, 16 MiB total
and 2 MiB per record. Evicted provenance cannot be fully rebuilt from official messages; eviction never
deletes DSH history. Bodies require retained, verifiable logs. Names/keywords in metadata can still be sensitive.
Sources identify section inputs, not character-level maps. Requested ST roles remain metadata; contributions
are currently system sections. Arbitrary message depth, exclusive takeover and permanent archival are unsupported.
Source originals are not duplicated; use v1 for current resources.

One Host writes a store; multi-process writes are unsupported. Cold inspect uses logical event coordinates,
not O(1) random access into compressed logs. Retained older DSH paths do not extend this candidate's target-runtime
evidence. Merge and release require maintainer acceptance.

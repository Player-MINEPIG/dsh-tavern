# 2.3.0 Trace candidate acceptance

Implementation candidate; no manual acceptance, merge, tag, or release yet.
Branch: `codex/trace-api-v3`, created from main. The former composer v3 branch was
not merged. [中文](TRACE_REVIEW.md) · [API and design](PROMPT_API_V3_en.md)

## Delivered requirements

- Ordered official named sections for existing preset/character/lore blocks, with
  source relationships captured during assembly and unchanged ordinary prompt text.
- Current bindings, complete documents and greeting options through v1 preview/resource
  APIs; consumers count current fields. v3 retains historical section/input counts.
- Per-turn/step/attempt runtime snapshots, bounded persistence, lazy historical
  queries, and exact system-message verification at the LLM boundary.
- Three read-only v3 endpoints, also consumed by Tavern Trace. Third parties may
  instead use official DSH seams; composition and coordination remain theirs.
- Explicit unknown, missing, failed, evicted and legacy metadata states.

Agent-preset creation (#5) and playthrough deletion (#6) remain independent work.
This delivery addresses provenance and history; it adds no exclusive takeover mode
and does not change existing approximate depth/PHI semantics. Released v1/v2 remain
available. As with v2, v3 provides primitives rather than a prescribed workflow.

## Completed automated and local acceptance

Environment: Node.js 22.23.1; DSH CLI and resolved affected core packages pinned to
**0.1.5-rc.1**. A CLI rc.1 install that resolves core packages to rc.2 is not accepted
as target-version evidence.

- Full `npm test`: 554 tests, 552 passed, zero failures, two optional skips (private
  external card fixture and opt-in live v2 HTTP smoke). Official migration codecs
  and the real AgentLoop test were enabled.
- Real official AgentLoop with a local synthetic LLM: official listeners see named
  Tavern sections; normal system text verifies; third-party reordering/replacement
  works with unknown attribution on changed text; `complete` mismatches are explicit;
  DSH persists system/message; unloading Tavern restores native prompt assembly.
- Unit/contracts cover interleaving and repeated original, existing macros/fallbacks/
  lore budgets, Unicode, retries/multiple steps, persistent reload, immutable old
  snapshots after current edits, duplicate-text ambiguity, limits/eviction/corruption,
  failure records, legacy records, read-only routes, validation and sanitized errors.
  Existing v1/v2 regressions pass.
- Actual isolated Web Host with local synthetic responses: a second browser-submitted
  turn appears automatically; official/preset sections and source text expand;
  script markup is plain text; no browser warnings/errors on the checked flow.
  No paid model, real private card, or user conversation is used.
- Default local `dsh --version` reports 0.1.5-rc.1; the existing web profile help entry
  loads; the older installation remains. This does not establish end-to-end model
  compatibility for every third-party plugin in that profile.

To reproduce, point both ROOT variables at a CLI dependency directory with
`package.json` that resolves the pinned official modules. Verify resolved package
versions with Node's `createRequire`, rather than trusting the CLI banner alone.

```sh
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm test
DSH_TAVERN_COMPAT_ROOT="$DSH_RUNTIME_ROOT" \
DSH_TAVERN_PROMPT_COMPAT_ROOT="$DSH_RUNTIME_ROOT" npm run verify:2.0
```

Without those variables, runtime tests explicitly skip. The browser fixture is
restricted to the temporary isolated profile and uses official Session/Agent/LLM
interfaces. The reproducible AgentLoop test is `test/trace-v3-host.test.mjs`.

## Final package and restart evidence

After removing the current `/sources` aggregate on 2026-09-18, the full suite still
reports 554 tests, 552 passes, no failures and two skips. `npm run verify:2.0` passes,
including build and packaging. Regressions verify the deleted endpoint returns 404,
capabilities omit `currentSources/maxSourceBytes`, and persisted source text and
Unicode counts survive reload.

Earlier browser restart/history checks and the 16/16 live v2 HTTP smoke apply to
the candidate before this removal. The Trace frontend is unchanged. The former
current-source reader is no longer contractual; the HTTP example exposes only
capabilities/index/detail.

The updated isolated DSH 0.1.5-rc.1 Host verifies the new capabilities and former
`/sources` 404. All three pre-restart records remain readable, including stored
Tavern input text. v1 configuration preview and preset details succeed; the history
index and selected detail remain identical across preview, with no new assembly.

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
   verify; source inputs are not character-by-character maps.
4. **Preserve history across edits/restart.** Save the first recordId/detail response,
   edit the card/preset and send another turn. Expect new content only in the new
   record, with unchanged old text/bindings/inputs. Restart and read the old record
   before activating the Session. Switch Sessions and toggle Trace rapidly; expect
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

## Limits before release

Prompt snapshots may contain sensitive text and are bounded local data. Eviction
does not delete DSH history. Sources are section inputs, not per-character maps;
contexts are assembly-stage facts. Current resources/configuration remain in v1;
v3 index/detail reads also work while the Agent is offline. One Host writes a store; multi-process writes are unsupported.
Older DSH paths remain, but new Trace runtime evidence targets 0.1.5-rc.1. Merge and
release follow maintainer acceptance.

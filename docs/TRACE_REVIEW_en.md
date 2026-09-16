# 2.3.0 Trace candidate acceptance

Implementation candidate; no manual acceptance, merge, tag, or release yet.
Branch: `codex/trace-api-v3`, created from main. The former composer v3 branch was
not merged. [中文](TRACE_REVIEW.md) · [API and design](PROMPT_API_V3_en.md)

## Delivered requirements

- Ordered official named sections for existing preset/character/lore blocks, with
  source relationships captured during assembly and unchanged ordinary prompt text.
- Current bindings, raw documents, greeting selection, field lengths and revisions.
- Per-turn/step/attempt runtime snapshots, bounded persistence, lazy historical
  queries, and exact system-message verification at the LLM boundary.
- Four read-only v3 endpoints, also consumed by Tavern Trace. Third parties may
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

`npm run verify:2.0` passed, including build and pack checks. All 202 installed package files matched the candidate; public links and package boundaries passed inspection. The separate live v2 HTTP smoke passed all 16 tests. After an actual Host restart, the browser reopened pre-restart records. The standalone v3 HTTP example read capabilities/sources/index/detail; editing the current synthetic preset changed its revision while the previous record stayed byte-for-byte unchanged.

## Maintainer manual checks

1. Use a complex real preset/card/user/world-book combination for at least two turns.
   Check marker interleaving, main/jailbreak original, first-turn greeting behavior,
   counts, lore decisions and readability against official system text.
2. Have the third-party developer try the HTTP reader and official observer examples.
   Verify plugin ordering, section replacement/reordering and sampling together.
   Official sections expose their names; use v3 for detailed mixed-input provenance.
3. Exercise a configured remote model with multi-step tools, cancellation, timeout
   and retries. `request-observed` proves entry to the LLM layer, not model success.
4. Edit resources after a turn, reopen the old record, then restart and reread it.
   Rapidly switch between Sessions and open/close Trace; check for stale responses.
5. Check normal window widths, themes, scaling, both languages and native/play
   switching with your actual plugin combination.
6. Validate existing third-party plugins, model connectivity and old Sessions after
   the CLI upgrade. Existing playthrough coordinate migration still follows the
   [migration guide](DSH_0.1.5_MIGRATION_en.md); upgrading CLI does not automatically
   rewrite Tavern timeline references.

## Limits before release

Prompt snapshots may contain sensitive text and are bounded local data. Eviction
does not delete DSH history. Sources are section inputs, not per-character maps;
contexts are assembly-stage facts. Current sources and historical details are
different contracts. One Host writes a store; multi-process writes are unsupported.
Older DSH paths remain, but new Trace runtime evidence targets 0.1.5-rc.1. Merge and
release follow maintainer acceptance.

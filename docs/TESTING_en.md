# Development verification

[简体中文](TESTING.md)

This guide explains how to verify the current implementation; it does not record acceptance results for a particular release. Select checks by change scope, then add integration evidence for the affected DSH interfaces.

## Environment and commands

Standalone Tavern tests require Node.js `>=20`; the target DSH `0.1.7-alpha.1` requires Node.js `^22.19.0 || >=24.0.0`. Use the latter requirement when running real DSH modules or a Host, and verify the versions of the core packages actually resolved. The standalone CI matrix does not establish support for every DSH runtime.

After installing dependencies, run these commands from the repository root. [package.json](../package.json) is the command definition source.

| Change scope | Check |
| --- | --- |
| Documentation only | Check content, bilingual parity, relative links, and diff; no build required |
| Localized logic | `node --test test/<relevant-file>.test.mjs` |
| Cross-module behavior | `npm test` |
| Client bundle | Relevant tests and `npm run build`; `dist/client.js` is generated |
| Full build and tests | `npm run check` |
| Protocol, installation, packaging, or release preparation | `npm run verify:2.0`, plus affected runtime checks |

`npm test` discovers tests through the Node test runner; `check` builds before running them. `verify:2.0` retains its historical command name: it runs the [listed test groups](../scripts/verify-2.0.mjs), then builds and runs `npm pack --dry-run`. It is not the full test suite and does not start a Web Host or browser.

<a id="patch-release-documents"></a>
## Patch release documentation

Use a patch version for compatible bug fixes; documentation corrections alone do not require a version bump. Release preparation must deliver a candidate with final versions, changelog, bilingual documentation, and installation examples, ready to publish immediately after review. Do not leave preparation status, unreleased labels, or old-version installation placeholders in candidate documentation; record pending review/publication in the handoff and `.local/`. Revise or roll back the candidate if review finds issues. Align the package version, Git tag, GitHub Release, and pinned installation examples. Never move or overwrite a published tag. Each push requires explicit authorization covering those changes; tags and releases also require authorization.

| File or release item | When to update |
| --- | --- |
| Root `package.json` and `package-lock.json` | Synchronize versions during release preparation; no bump for documentation-only changes |
| Root [CHANGELOG.md](../CHANGELOG.md) | Record the final version, fix, user impact, and compatibility limits in the candidate; do not invent a publication date |
| Chinese and English README and INSTALLATION | Synchronize the final version in the candidate, switch install and source-checkout examples to the intended tag, and state the target DSH and migration requirements |
| Chinese and English API and USAGE | Update changed interface behavior, error codes, or user-visible results; internal fixes with an unchanged contract need no edits |
| Chinese and English TESTING | Add reusable regression scenarios or verification methods when needed |
| Architecture, migration, security documents and diagrams | Update only when the corresponding design, data format, or security boundary changes; a patch bump alone requires no rewrite |
| Git tag and GitHub Release | At publication, create the matching tag and concise release notes covering the fix, target DSH, upgrade steps, and known limits |

Keep run-specific logs, screenshots, test counts, and release-note drafts in Git-ignored `.local/`; summarize relevant evidence in the PR. Keep reusable procedures in `docs/`, without accumulating per-release acceptance records. Update corresponding Chinese and English files in the same change.

Run `npm run verify:2.0` and inspect package contents before release; validate affected APIs, Host behavior, and UI as described here. Later documentation or version-metadata changes can reuse runtime evidence for the same implementation and target DSH, identifying the tested commit, without repeating unrelated interactions. New DSH compatibility requires fresh verification; old Host results do not establish support.

## Enable integration tests with official modules

Both variables point to directories from which Node can resolve the target DSH dependencies. Tests use `package.json` under each directory as the resolution base. These paths are neither `DSH_HOME` nor an RP workspace.

| Variable | Required modules and coverage |
| --- | --- |
| `DSH_TAVERN_COMPAT_ROOT` | Session format/catalog, migration packages, and session controller; real codecs, migration of temporary logs, and official error mapping |
| `DSH_TAVERN_PROMPT_COMPAT_ROOT` | Cordis, SystemPrompt, Session, AgentLoop, LLM, and other Host modules; official assembly, request observation, event references, and failure attribution |

An installed DSH distribution can usually use one root for both. A source checkout may resolve these dependencies from different directories; tests do not search `apps/cli` or other workspaces automatically. This POSIX shell example uses placeholder dependency paths. In PowerShell, set the same variables using `$env:VARIABLE_NAME`.

```sh
export DSH_TAVERN_COMPAT_ROOT="/path/to/dsh-dependencies"
export DSH_TAVERN_PROMPT_COMPAT_ROOT="/path/to/dsh-host-dependencies"
npm run check
npm run verify:2.0
```

For targeted checks:

```sh
node --test test/coordinate-migration-integration.test.mjs test/session-coordinates.test.mjs
node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs test/preset-fallback-host.test.mjs
node --test test/dsh017-host-migration.test.mjs test/dsh017-client-sessions.test.mjs test/resource-capabilities.test.mjs
node --test test/standalone-client-boundary.test.mjs
```

The official-module checks in these tests skip when their variables are absent; an invalid configured root fails. They use temporary data and real DSH modules. AgentLoop tests use a synthetic model adapter, do not contact a real provider, and do not validate Web Remote, browsers, or actual third-party plugins.

Separately, `DSH_TAVERN_ACCEPTANCE_FIXTURE` enables a [specific external preset fixture check](../test/acceptance-fixture.test.mjs), not a general acceptance test for arbitrary character cards. It skips when the variable is absent or the file does not exist; contents that do not meet its assertions fail. Some path checks may also skip when the platform disallows symlink/junction creation. Read the reasons reported by the runner; skipped checks are not passes.

For this compatibility boundary, additionally check all five resources through create/import/export/edit on an isolated Host; unsaved template protection on Escape and panel switching; independently retained sessions switching RP, native Chat and Trace; and recovery after temporary binding-read failures. Sampling tests exercise explicit parameter rejection, prior output, abort and authentication failure, checking bounded retries and Trace requested/effective/fallbacks. Migration covers V3 interruption insertion and child catalogs, earlier format chains, backup conflicts and reruns. The standalone boundary test establishes resource bundling and initialization without DSH bootstrap, not a complete independent conversation UI.

## Host and browser checks

Use an authorized, isolated test profile, a workspace copy, and the target DSH version; see [installation](INSTALLATION_en.md). After replacing backend files in a running Host, restart it to load the new code.

This opt-in smoke only reads v2 `GET /chrome` and `GET /workspace`, checking mode and workspace information from a running Host. It does not cover writes, Remote transport, or UI lifecycle. Replace the URL with the test Host address.

```sh
DSH_TAVERN_PLAY_LIVE=1 \
DSH_TAVERN_PLAY_LIVE_URL="http://127.0.0.1:<port>" \
node --test test/play-sessions.test.mjs
```

Select interaction checks for the affected behavior:

- **RP and UI lifecycle:** Switch between native/RP modes, workspaces, and characters without leaking messages between sessions. Check greeting boundaries, control recovery from streaming to terminal states, and affected swipe/branch flows. Missing old logs should surface a problem without blocking healthy or new playthroughs.
- **History actions during generation:** During ordinary generation and a later-turn swipe, verify variant switching, swipe, fork, and rollback are disabled on all historical replies with a reason. Copy, display save and restore remain usable; edits appear immediately in pending RP context and survive terminal commit. Another playthrough remains usable; completion, failure and interruption restore path actions.
- **Pending swipe and cancellation:** Use a slow synthetic stream for both first-turn and later-turn swipes. Immediately after session creation, verify that RP and native Chat target the same new session and clicking the playthrough again returns there. Check that preceding context is not duplicated, new text streams in, and the native stop button works. Cancel before the first chunk and after some chunks, checking the error return action or adoption of actual persisted coordinates without losing existing variants.
- **Historical forks and pending input:** Complete two turns in a temporary Host, then append queued/steering input through the public inbox without waking the Agent. Use native fork as a control, and exercise the Tavern branch API, same-playthrough rollback, new-playthrough fork, and a non-first-turn swipe. Check actual model requests for stale input and duplicate swipe input, empty child inboxes, and preserved source queues and inherited history. Send again after a Host restart to check that canceled input stays canceled. Cleanup failure must report an explicit error before context copying or timeline commit.
- **Playthrough archive:** Archiving must hide the playthrough from the default list without exposing its members as loose or ordinary sessions; refresh and restart must preserve this state. Viewing from the archive must not restore it implicitly. Restoring must preserve numbering, names, branches, and bindings. Creating after archiving the latest empty playthrough must use the next number, and sessions shared with an active playthrough must remain visible there. Compare timelines, selections, and DSH logs before and after archiving to confirm that only the archive marker in the catalog changes.
- **Trace:** Compare the recorded configuration, world-book decisions, Loader section order, text, and sources with the official request. Read old records again after a restart; removing official logs from a test copy must make their text explicitly unavailable. Failure records still derive from official events and must not add failed assistant messages to RP. See the [Prompt API v3 contract](PROMPT_API_V3_en.md).
- **Streaming interaction:** In an RP conversation with multiple rich-text history messages, open, close, and drag the launcher during generation. Each chunk must not reparse or sanitize unchanged history; expanded historical details must stay open. `node scripts/verify-rich-text-browser.mjs` mounts real React components to verify that continuous updates sanitize only changed messages, preserve style isolation, and replace terminal content. Synthetic checks do not establish acceptance of the real model streaming path.
- **Rich text and diagnostics:** Check static HTML/CSS isolation, display regexes, and script filtering. MVU and JavaScript-driven dynamic HTML are not implemented capabilities. Check consistency across problem entry points, summary dismissal, rechecking, and recovery. Trace text must remain plain text.

For concurrent writes, uninstall, or coordinate migration, validate conflict and recovery paths on test copies; see [API](API_en.md) and the [migration guide](DSH_0.1.7_MIGRATION_en.md). Real-provider timeouts/retries, actual third-party integration, and platform differences need separate evidence; synthetic failures or another platform's results do not establish them.

Record the source revision, Node/DSH versions, enabled checks, skipped checks, and reproduction steps. Distinguish automated tests, real Host, browser, and external integration coverage. Diagnostic reports and Trace metadata can contain private identifiers and content; review and remove sensitive details before publishing a problem report.

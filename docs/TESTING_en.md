# Development verification

[简体中文](TESTING.md)

This guide explains how to verify the current implementation; it does not record acceptance results for a particular release. Select checks by change scope, then add integration evidence for the affected DSH interfaces.

## Environment and commands

Standalone Tavern tests require Node.js `>=20`; the target DSH `0.1.5-rc.1` requires Node.js `^22.19.0 || >=24.0.0`. Use the latter requirement when running real DSH modules or a Host, and verify the versions of the core packages actually resolved. The standalone CI matrix does not establish support for every DSH runtime.

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
node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs
```

The official-module checks in these tests skip when their variables are absent; an invalid configured root fails. They use temporary data and real DSH modules. AgentLoop tests use a synthetic model adapter, do not contact a real provider, and do not validate Web Remote, browsers, or actual third-party plugins.

Separately, `DSH_TAVERN_ACCEPTANCE_FIXTURE` enables a [specific external preset fixture check](../test/acceptance-fixture.test.mjs), not a general acceptance test for arbitrary character cards. It skips when the variable is absent or the file does not exist; contents that do not meet its assertions fail. Some path checks may also skip when the platform disallows symlink/junction creation. Read the reasons reported by the runner; skipped checks are not passes.

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
- **Historical forks and pending input:** Complete two turns in a temporary Host, then append queued/steering input through the public inbox without waking the Agent. Use native fork as a control, and exercise the Tavern branch API, same-playthrough rollback, new-playthrough fork, and a non-first-turn swipe. Check actual model requests for stale input and duplicate swipe input, empty child inboxes, and preserved source queues and inherited history. Send again after a Host restart to check that canceled input stays canceled. Cleanup failure must report an explicit error before context copying or timeline commit.
- **Playthrough archive:** Archiving must hide the playthrough from the default list without exposing its members as loose or ordinary sessions; refresh and restart must preserve this state. Viewing from the archive must not restore it implicitly. Restoring must preserve numbering, names, branches, and bindings. Creating after archiving the latest empty playthrough must use the next number, and sessions shared with an active playthrough must remain visible there. Compare timelines, selections, and DSH logs before and after archiving to confirm that only the archive marker in the catalog changes.
- **Trace:** Compare the recorded configuration, world-book decisions, Loader section order, text, and sources with the official request. Read old records again after a restart; removing official logs from a test copy must make their text explicitly unavailable. Failure records still derive from official events and must not add failed assistant messages to RP. See the [Prompt API v3 contract](PROMPT_API_V3_en.md).
- **Rich text and diagnostics:** Check static HTML/CSS isolation, display regexes, and script filtering. MVU and JavaScript-driven dynamic HTML are not implemented capabilities. Check consistency across problem entry points, summary dismissal, rechecking, and recovery. Trace text must remain plain text.

For concurrent writes, uninstall, or coordinate migration, validate conflict and recovery paths on test copies; see [API](API_en.md) and the [migration guide](DSH_0.1.5_MIGRATION_en.md). Real-provider timeouts/retries, actual third-party integration, and platform differences need separate evidence; synthetic failures or another platform's results do not establish them.

Record the source revision, Node/DSH versions, enabled checks, skipped checks, and reproduction steps. Distinguish automated tests, real Host, browser, and external integration coverage. Diagnostic reports and Trace metadata can contain private identifiers and content; review and remove sensitive details before publishing a problem report.

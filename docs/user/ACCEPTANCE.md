# User resource acceptance

状态：2026-08-15，feature branch 自验收记录。本文不是 README，也不代表已经合并。

## Acceptance matrix

| Requirement | Evidence |
| --- | --- |
| exact `{id,name,description}` and no avatar | store/API architecture tests assert exact keys and reject `avatar`/unknown fields; client source contains no image/avatar surface |
| CRUD and persistence | store create/update/list/get/delete plus fresh `UserStore` reload tests |
| API and management UI | JSON route tests cover all methods; client composition exposes create/edit/save/bind/unbind/delete |
| one user per session | `SessionSelectionStore.userId` is scalar/nullable; two-session API and real-loader tests use different users |
| immediate switching | selection and document updates are read on the next loader compile; UI/Host refresh signals are emitted |
| restart restoration | a fresh root `apply()` restores `session-selections.json` and the stored user document |
| name macro | profile tests resolve `{{user}}` in preset and user description from the selected session user |
| marker and fallback | official `personaDescription`, explicit `{{persona}}`, duplicate suppression, stable fallback order and diagnostic are asserted |
| unbind and delete cleanup | API and real-loader tests prove explicit null unbinding and cross-session deletion cleanup |
| DSH identity and one request contribution | Host assembly retains the harness section and exactly one `dsh-tavern:profile`; description occurs once |
| real loader snapshot | `test/snapshots/user-profile-loader.json` is compared against a synthetic resource compiled through root `apply()` |

## Fixtures and data hygiene

All names and descriptions are self-authored minimal strings created in temporary directories. No third-party preset, persona, role card, avatar, character card or world book was read or copied. The committed snapshot contains only the synthetic user resource and compiled loader result needed to review the contract.

## Verification commands

Final command results are recorded at handoff after running:

```text
node --test test/user-store.test.mjs test/user-api.test.mjs test/profile-loader.test.mjs test/tavern-integration.test.mjs test/host-contract.test.mjs
npm run check
npm run pack:check
```

The review also scans tracked/staged content for absolute machine paths, credentials and private-key material, checks the npm preview excludes tests/docs/runtime data, and confirms `packages/user` has no Host seam or avatar/image implementation.

Recorded result:

- focused user/loader suite: 31/31 passed before the root-dispatch regression was added; that regression also passes in the full suite;
- `npm run check`: build succeeded; 93 passed, 1 skipped, 0 failed (94 total). The skip is the existing opt-in repository-external preset fixture because `DSH_TAVERN_ACCEPTANCE_FIXTURE` was not supplied;
- `npm run pack:check`: succeeded with 40 files; `packages/user/**` and rebuilt `dist/client.js` are included, while docs, tests, snapshots, runtime `data/`, caches and external fixtures are excluded;
- machine-path/username/private-key/common credential scans returned no match; `packages/user` seam/avatar scan returned no match;
- `git diff --check` returned no whitespace errors.

## Known limitations

- Persona position choices beyond Prompt Manager marker/system fallback are not implemented because DSH does not expose an arbitrary role/depth injection seam.
- A switch cannot erase the influence of earlier assistant/history text; it only changes subsequent request assembly.
- This feature branch does not implement independent world-book selection, launcher status lights or Tavern Trace.

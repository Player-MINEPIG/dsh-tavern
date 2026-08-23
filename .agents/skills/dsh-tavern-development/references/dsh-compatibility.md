# Versioned DSH compatibility

Use this reference whenever work depends on DSH behavior rather than Tavern-only logic.

## Resolve the target version first

Use sources in this order:

1. The DSH version named by the task or reported by the actual installation.
2. Code, exported types, and official documentation at that version's immutable upstream tag or commit.
3. dsh-tavern compatibility documents and tests written for that version.
4. Upstream `master` only as migration research; never present it as an available contract on an older target.

The accepted dsh-tavern 2.0 baseline is DSH `0.1.0-rc.8` (upstream ref `dsh-v0.1.0-rc.8`) unless the task establishes another target. DSH is pre-release software and may intentionally change names, packages, services, persistence, and compatibility behavior between refs. Do not infer backward compatibility from the latest source.

For each DSH seam used or changed, verify the relevant contract dimensions at the target ref, such as its service or slot name, type signature, scope, owner/store semantics, lifecycle/disposal behavior, events or Remote transport, durable schema, and failure behavior. Local Tavern documents describe the integration but do not override the target DSH implementation.

## Separate Node support claims

- The Tavern package declares Node `>=20`, and its CI tests Node 20 and 22.
- Integration with DSH must also satisfy the selected DSH ref's own `engines.node` requirement.
- Run actual Host checks on a Node version in the intersection. Do not use Tavern's standalone range to claim that a newer DSH installation supports Node 20.

## Choose the smallest sufficient validation

- Pure functions or narrow logic: targeted `node --test test/<relevant-file>.test.mjs`.
- Cross-package behavior: `npm test`.
- Narrow client logic: the relevant client test file.
- Changes affecting the generated client bundle: relevant tests plus `npm run build`.
- Cross-module client behavior or integration preparation: `npm run check`.
- Host API read integration: the current opt-in smoke is `DSH_TAVERN_PLAY_LIVE=1 DSH_TAVERN_PLAY_LIVE_URL=<url> node --test test/play-sessions.test.mjs`. It only reads `GET /chrome` and `GET /workspace`; it does not prove writes, service/Remote compatibility, client slots, stores, mounting, disposal, switching, or browser behavior.
- DSH service or Remote changes: exercise the affected call path against an actual Host running the target DSH version, in addition to focused automated tests.
- Client slot, store, or lifecycle changes: use focused tests plus browser or real-runtime acceptance on the target DSH version for the relevant ownership, mounting, disposal, switching, and interaction behavior. If no automated command covers it, state that the runtime acceptance remains unverified.
- Protocol, installer/package contents, or release readiness: `npm run verify:2.0`, plus any requested real install/uninstall acceptance.

Do not run release-level verification for an unrelated small change. Report the DSH or Node ref exercised and omitted integration checks only when they materially affect the task or confidence in the result.

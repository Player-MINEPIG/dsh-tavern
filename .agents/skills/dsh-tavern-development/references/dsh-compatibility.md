# Versioned DSH compatibility

Use this reference whenever work depends on DSH behavior rather than Tavern-only logic.

## Resolve the target version first

Use sources in this order:

1. The DSH version named by the task or reported by the actual installation.
2. Code, exported types, and official documentation at that version's immutable upstream tag or commit.
3. dsh-tavern compatibility documents and tests written for that version.
4. Upstream `master` only as migration research; never present it as an available contract on an older target.

The accepted dsh-tavern 2.0 baseline is DSH `0.1.0-rc.8` (upstream ref `dsh-v0.1.0-rc.8`) unless the task establishes another target. DSH is pre-release software and may intentionally change names, packages, services, persistence, and compatibility behavior between refs. Do not infer backward compatibility from the latest source.

For every DSH seam used or changed, verify the target ref's service or slot name, type signature, scope, owner/store semantics, lifecycle/disposal behavior, events or Remote transport, durable schema, and failure behavior. Local Tavern documents describe the integration but do not override the target DSH implementation.

## Separate Node support claims

- The Tavern package declares Node `>=20`, and its CI tests Node 20 and 22.
- Integration with DSH must also satisfy the selected DSH ref's own `engines.node` requirement.
- Run actual Host checks on a Node version in the intersection. Do not use Tavern's standalone range to claim that a newer DSH installation supports Node 20.

## Choose the smallest sufficient validation

- Pure functions or narrow logic: targeted `node --test test/<relevant-file>.test.mjs`.
- Cross-package behavior: `npm test`.
- Client code or generated bundle: `npm run check`.
- DSH service/slot/Remote or Host/client lifecycle: focused automated tests plus a smoke test on the target DSH version. The current opt-in read smoke is `DSH_TAVERN_PLAY_LIVE=1 DSH_TAVERN_PLAY_LIVE_URL=<url> node --test test/play-sessions.test.mjs`.
- Protocol, installer/package contents, or release readiness: `npm run verify:2.0`, plus any requested real install/uninstall acceptance.

Do not run release-level verification for an unrelated small change. Report which DSH version/ref and Node version were exercised, and which integration checks were not run.

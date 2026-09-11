# Versioned DSH compatibility

Use this reference when a change depends on DSH behavior rather than Tavern-only logic.

## Target contract

Use the task's explicit DSH target. Otherwise resolve the supported range from the current [README](../../../../README.md), [package.json](../../../../package.json), and relevant compatibility documents. A historical Tavern baseline is not the current default.

The installed DSH version is a validation environment, not a replacement for the target contract. Verify affected public seams against code, exported types, or official documentation at the target's immutable upstream tag or commit. Upstream `master` is migration evidence, not proof of older-version behavior; prerelease versions may break compatibility.

Inspect the dimensions affected by the change: service or slot signatures, ownership, lifecycle/disposal, Remote events, durable schema, or failure behavior. Tavern documents explain the integration but do not override the target DSH implementation.

For Node support, intersect Tavern's `engines.node` with the target DSH requirement and any runtime features exercised by the check. The [CI matrix](../../../../.github/workflows/ci.yml) establishes standalone test coverage, not compatibility with every DSH runtime.

## Integration evidence

Choose checks for the affected behavior; local build and test commands are in [AGENTS.md](../../../../AGENTS.md).

- Host reads: `DSH_TAVERN_PLAY_LIVE=1 DSH_TAVERN_PLAY_LIVE_URL=<url> node --test test/play-sessions.test.mjs`. The opt-in live smoke reads only v2 `GET /chrome` and `GET /workspace`; it does not establish writes, Remote compatibility, or browser lifecycle behavior.
- DSH services or Remote calls: exercise the affected path on a Host running the target version.
- Client slots, stores, or lifecycle: verify affected mounting, ownership, disposal, switching, and interactions in the target runtime/browser.
- Session-coordinate migration: see [migration guidance](../../../../docs/DSH_0.1.5_MIGRATION.md) and [integration tests](../../../../test/coordinate-migration-integration.test.mjs). `DSH_TAVERN_COMPAT_ROOT` points to the DSH dependency environment; these tests use real codecs with temporary data, not a live Host.

Use task-authorized environments. If required runtime evidence is unavailable, finish independent work and report the specific validation gap and versions actually exercised; do not claim full integration acceptance from fixtures or skipped tests.

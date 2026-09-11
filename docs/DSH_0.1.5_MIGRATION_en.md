# DSH 0.1.5-rc.1 compatibility and playthrough migration

[中文](DSH_0.1.5_MIGRATION.md)

This page describes the `2.2.0` compatibility update. There are no new UI features, but the public coordinates API and additive fields expand the public contract, warranting a minor version; internal compatibility fixes alone would use `2.1.1`. It retains DSH `0.1.2-rc.1` and adapts `0.1.5-rc.1`, without promising other candidate versions. The newer Host requires Node `^22.19.0 || >=24.0.0`; Tavern's standalone Node `>=20` declaration does not override this requirement.

For the retained public coordinate query API, start with [requests, fields, and branch examples](API_en.md#session-coordinates). DSH defines the format version; Tavern infers the migration marker. The query does not migrate old references.

## Contract changes

- Trace reads `header.system` on V0–V2 and the effective system surface from public `Session.deriveMessages()` on V3. It persists fingerprints and verdicts, never prompt text. `authority.systemSource` identifies `request/header` or `system/message`.
- New QA/swipe variants store `ext.pmpDshTavern.sessionFormatVersion`. `GET /v2/sessions/:id/messages` adds optional `sessionFormatVersion` and `migratedFromV2`; `GET /v2/sessions/:id/coordinates` exposes those facts without message bodies.
- Timeline GET/PUT validates coordinate versions. A mismatch, or unversioned references to a Session carrying V2→V3 insertion markers, returns `409 PLAY_COORDINATES_MIGRATION_REQUIRED`. No offset is guessed and no file is silently rewritten.
- `POST /v2/sessions/:id/branch` accepts `sessionFormatVersion`, required to match the current format for migrated Sessions. The check precedes Host fork. The bundled client supplies the observed/saved version.
- Import claims, terminal cuts, and lineage references are versioned too; old coordinates must migrate before reuse.
- The required crypto peer admits exactly `0.1.2-rc.1 || 0.1.5-rc.1`; Cordis stays at `4.0.2`. pnpm may still report missing profile peers because DSH supplies packages at startup. An actual `ERR_MODULE_NOT_FOUND` is not ignorable.

The full API prefix is `/pmp-dsh-tavern/api`. Existing IDs, head, external extensions, and CAS revision semantics remain intact.

## Why migration is necessary

DSH 0.1.2-rc.1 writes V0 logs. Its official V0→V1→V2→V3 chain collapses assistant chunks at V1→V2 and inserts system messages at V2→V3, changing sequence positions and inherited cuts. It remaps recognized references inside its own log, not Tavern's external JSON. The number of insertions varies with prompt changes. Retaining the original historical log does not make V3 writes readable by older Hosts.

If unpatched Tavern has already produced a mixture of unversioned historical/V3 references, do not declare all those references historical. Establish each range's provenance from backups first. The command cannot infer a missing version from an integer.

## Offline command

Back up DSH data and the RP workspace. Use DSH's ordinary upgrade path to materialize V3, then stop every Host that could write the files. The command neither creates nor modifies DSH logs.

Prepare a manifest using absolute filesystem paths and workspace-relative timeline paths:

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "storageDir": "/path/to/DSH_HOME/pmp-dsh-tavern",
  "sessions": [
    {
      "source": "/path/to/session/session.v2.jsonl.zstd",
      "target": "/path/to/session/session.v3.jsonl.zstd"
    }
  ],
  "timelines": ["character-id/playthrough-id/timeline.json"]
}
```

`dshRoot` resolves the installed `@deepseek-ai/dsh-session-format-v2-to-v3@0.1.5-rc.1`, usually through its `node_modules`; it is not DSH_HOME. Raw JSONL and `.zstd` with multiple appended frames are supported. Sources may be V0, V1, or V2; V0 typically uses `session.jsonl.zstd`, and the header determines the format. Source and target must identify the same Session, and the target must begin with the exact official migration output. Subsequent V3 events are allowed.

Include every variant's Session and any import-lineage parents. The manifest declares unversioned references to use the corresponding source format; existing markers must match it, and V3 markers are skipped. V0/V1 mapping supports uniquely identified user/message, assistant/message, and turn/end coordinates; removed chunks or arbitrary other event references refuse. Missing mappings, different logs, unknown versions, and invalid artifacts refuse before writes.

```sh
# Validate and preview without writing
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json

# Apply the reviewed migration while DSH is stopped
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json --apply
```

Only listed timelines and related coordinates in `storageDir/import-context-bindings.json` change. Character cards, presets, display text, DSH history, Session IDs, node IDs, and variant IDs are retained. Each changed file gets an exact `.pre-v3-coordinates` backup and is replaced through a temporary file and rename.

Writes are individually atomic, not a multi-file transaction. After interruption, keep DSH stopped and rerun the same manifest: V3 references are skipped and remaining files continue. A conflicting backup refuses overwrite and requires inspection. Restart the Host after completion and check history, swipes, and forks.

## Verification

```sh
npm run check
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install node --test test/coordinate-migration-integration.test.mjs
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install npm run verify:2.0
```

The integration test loads the real official codec and migrator from that installation, using synthetic V0/V1/V2→V3 multi-frame compressed logs to test chunk collapse, truncated/mismatched-target refusal, remapping, import claims/terminals, backups, and reruns. It explicitly skips without the environment variable. Fixture tests do not replace real Host acceptance, model-quality checks, KV Cache measurements, or validation of actual user history.

Sources: [target release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.1), [V2→V3 specification](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.1/packages/session/session-format-v2-to-v3/README.md).

### Actual acceptance on 2026-09-10 (unreleased workspace)

Node 22.23.1, isolated DSH_HOME, actual DSH Hosts with a local mock model:

- Both 0.1.2-rc.1 and 0.1.5-rc.1 passed plugin loading, preset injection, sampling parameters, completed replies, Trace, and RP playthrough checks.
- A real V0 playthrough created by 0.1.2 was opened by 0.1.5 in the same isolated data directory. The old timeline returned the expected migration 409. Validation of the real multi-frame source/successor logs, backup, apply, and rerun passed.
- The final build passed swipe creation and switching in both directions, plus import claim consumption and fork lineage with V3 markers. `npm run check` with real-codec tests enabled: 538 passed, 2 existing opt-in tests skipped. `verify:2.0` passed.
- The old QA range changed correctly from `8..19` to `9..16`. After restart, both the original and post-upgrade replies remained visible; forking at the old QA retained exactly that history.

These checks used synthetic characters and replies. They did not migrate actual user data or validate real-model quality or KV Cache performance.

### Rendering-fix user acceptance on 2026-09-11

The user accepted the rendering fixes installed into the temporary DSH `0.1.5-rc.1` environment, covering Markdown inside details and the corrected HTML/CSS display template. Template JavaScript remains blocked. This confirmation does not extend to actual user-history migration or KV Cache performance. See the [acceptance record](PLAY_REVIEW_en.md#220-rich-text-rendering-acceptance-2026-09-11).

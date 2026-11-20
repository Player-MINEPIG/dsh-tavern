# DSH 0.2.2 compatibility and historical coordinate upgrade

[中文](DSH_0.1.7_MIGRATION.md)

The supported Host is DSH **0.2.2-rc.1**, whose current Session writer is V4. Earlier DSH runtimes are not supported. Reading and upgrading historical formats is a data compatibility path, not an older-runtime promise. Use Node `>=24.9.0`, as required by the target Host.

DSH durable history remains authoritative. Tavern uses public lifecycle, Session, and controller interfaces; removing Tavern leaves native DSH and the original Sessions usable. The upgrade is one-way. Retained predecessors and backups protect the original data; there is no Tavern rollback tool, and a Host without V4 support cannot read V4 writes.

When upgrading an older DSH to 0.2.2-rc.1, V4 data whose Tavern references are already marked V4 needs no additional conversion. Offline migration accepts only the verified 0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3 and 0.2.2-rc.1 format libraries. This whitelist is independent of Host admission and does not automatically accept future RCs.

## Current coordinates and Trace

- New QA/swipe ranges carry `variant.ext.pmpDshTavern.sessionFormatVersion`. The [coordinate API](API_en.md#session-coordinates) reports the current Session format without changing references or returning message bodies.
- V4 timeline ranges, branch requests, and import references must carry the matching format. Missing or stale coordinate versions return `409 PLAY_COORDINATES_MIGRATION_REQUIRED` before the Host fork or reference-dependent operation. V4 does not have a reliable universal migration marker; `migratedFromV2: false` does not make unversioned coordinates safe.
- Imported-context claims, terminals, and parent lineage have their own Session coordinates. Include every Session whose coordinates the selected files contain.
- New Trace uses `system/message` and official context `user/message` references. V4 context snapshots use `source.kind: "runtime-context"`; system prompts use `system-prompt`. The [Trace contract](PROMPT_API_V3_en.md) describes cold inspection, identity/hash checks, and explicit unavailability.
- API v3, Trace schema 4, and DSH Session format V4 are independent version numbers.

The API prefix is `/pmp-dsh-tavern/api`. The upgrade preserves Session IDs, timeline node/variant IDs, head, unrelated extensions, and existing resource content.

## Why references need upgrading

Official V0→V1→V2→V3→V4 restoration can change logical event coordinates. V1→V2 collapses assistant chunks; V2→V3 inserts system messages. V3→V4 can insert an evidenced interrupted `turn/end` before a later source event, converts producer-owned sources and tool-role results, and appends missing parent catalog records from retained direct-child evidence. A single numeric offset is not valid.

DSH migrates references it owns inside its logs. It does not rewrite Tavern's external JSON. Tavern's offline command follows the exact installed official migration stages and checks the complete transformed artifact against the target log before changing external references. It never guesses an event remap from message text or integer position alone.

If an unversioned file already mixes coordinates from different generations, first establish each reference's source from retained evidence. The manifest declares that unversioned references belong to its source log; it cannot discover that fact from integers.

## Recovering missing V4 markers without a predecessor log

### Batch repair after a V3→V4 upgrade

Use automatic repair when the unmarked ranges were valid references from the same Session in either V3 or V4. The command scans the entire timeline, including inactive replies. List the corresponding V4 logs in the manifest. Preview first, then stop DSH before applying the reviewed changes.

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "timeline": "character-id/playthrough-id/timeline.json",
  "sessions": [{ "target": "/path/to/session/session.v4.jsonl.zstd" }]
}
```

```sh
node scripts/migrate-session-coordinates.mjs --auto-v3-v4 --manifest recovery.json
node scripts/migrate-session-coordinates.mjs --auto-v3-v4 --manifest recovery.json --apply
```

V3→V4 preserves source events in order and can insert an interrupted turn closer. The command checks question and reply endpoints before the first possible insertion. When the log has no interrupted closer, this covers the full history.

`stamped` lists eligible variants. `remaining` gives a reason for each unresolved variant. For `possible-v3-offset`, you can supply one `postUpgradeUserMessageId` in that Session’s manifest entry if native history or a saved record independently identifies a question newly sent to that Session after the upgrade. The command can then verify ranges starting at or after that question in one batch. Its ID alone cannot establish when it was written relative to the upgrade. A remaining unverified V4 reference can still cause a 409 when opening the playthrough.

If unmarked ranges could use V0–V2 coordinates, the log was manually truncated, or Session ownership is uncertain, use retained source logs for migration or verify individual message identities below.

### Repair by message identity

If a timeline returns `409 PLAY_COORDINATES_MIGRATION_REQUIRED` after recent turns, inspect the workspace copy of its `timeline.json`, including inactive swipes. For each unmarked variant, identify the original question and reply independently, for example from a saved messages response for that turn or by recognizing the exact pair in the native Session history and confirming its message IDs. Looking up the two integers in the current log alone cannot establish which messages the variant originally referenced. Leave uncertain variants for historical migration or recovery from backup.

Use this manifest for one timeline. Supply the V4 log for each selected Session, including the child's own log for a forked variant.

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "timeline": "character-id/playthrough-id/timeline.json",
  "sessions": [{ "target": "/path/to/session/session.v4.jsonl.zstd" }],
  "variants": [{
    "nodeId": "qa-id", "variantId": "variant-id", "sessionId": "session-id",
    "userMessageId": "original-question-id", "assistantMessageId": "original-reply-id"
  }]
}
```

Run the first command to preview. Review `stamped` and `remaining` (variants still lacking a V4 marker). To apply, stop DSH and run the second command.

```sh
node scripts/migrate-session-coordinates.mjs --stamp-only --manifest stamp.json
node scripts/migrate-session-coordinates.mjs --stamp-only --manifest stamp.json --apply
```

The command verifies both message IDs at the stored endpoints in the named Session and refuses selected variants with an explicit older version. It backs up the timeline beside the original as `timeline.json.pre-v4-stamp-<sha256>` before replacing it. Repeating the same manifest skips matching V4 markers. To undo a repair, stop DSH and restore the corresponding backup. Stamp-only changes the selected markers. Historical event remapping, import bindings and Trace use the migration procedure below.

## Preparing the upgrade

Back up the DSH data directory and RP workspace. Use the normal DSH upgrade path to create V4 successors, retaining the old logs and inheritance dependencies. Stop all DSH processes that can write the selected files before applying Tavern's upgrade. The command neither creates nor rewrites DSH logs.

Loading an old RP workspace into a different DSH_HOME does not copy its Sessions. `session "…" not found` means the current Host cannot locate that history, even if the timeline is already marked V4. Restore the original data directory or the required logs and their dependencies; changing Session IDs or clearing the timeline destroys the association. A missing historical Session remains distinct from a coordinate-format error.

Prepare this manifest using absolute log and root paths; `timelines` contains paths relative to the RP workspace:

```json
{
  "dshRoot": "/path/to/dsh-install",
  "workspace": "/path/to/rp-workspace",
  "storageDir": "/path/to/DSH_HOME/pmp-dsh-tavern",
  "sessions": [
    {
      "source": "/path/to/session/session.v3.jsonl.zstd",
      "target": "/path/to/session/session.v4.jsonl.zstd",
      "children": []
    }
  ],
  "timelines": ["character-id/playthrough-id/timeline.json"]
}
```

`dshRoot` must resolve the official format/catalog packages from **0.1.7-alpha.1, 0.1.7-alpha.2, 0.1.7-rc.1, 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3 or 0.2.2-rc.1**, including `@deepseek-ai/dsh-session-format-v3-to-v4`; it is not DSH_HOME. Sources may be V0, V1, V2, or V3. Targets must be V4. Plain JSONL and appended multi-frame `.zstd` files are supported; the header determines the format, not the filename.

Every pair requires `children`: the complete available list of retained direct-subagent-child log paths, or explicit `[]` when none are available. The command derives child facts through official readers, checks direct parent membership and unique child identities, and refuses conflicting evidence. It does not infer missing descriptors or child identities from tool arguments. Supply the retained child generation appropriate to the verified successor; changed descriptors can make a successor mismatch.

Each source/target pair must identify the same Session. The target must contain the exact official migration output as a complete prefix; validated subsequent V4 events may follow. Include every timeline Session and any parent owning import lineage coordinates. Already V4 references are skipped. Explicit old versions must agree with the source. V0/V1 upgrades only map uniquely verified message/terminal coordinates where the earlier edge collapses events; removed chunks and unsupported references refuse.

```sh
# Validate and preview all changes without writing
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json

# Apply the reviewed upgrade with DSH stopped
node scripts/migrate-session-coordinates.mjs --manifest /path/to/migration.json --apply
```

## Files, backups, and refusal

The command processes the listed timelines and related records in these files under `storageDir`, when present:

- `import-context-bindings.json`;
- `tavern-trace-records.json`;
- `tavern-traces.json` and `tavern-assemblies.json` for historical audit coordinates.

Trace body/failure references, log cuts, delivery format, audit header coordinates, and activation claims are upgraded together. Body and error references must resolve against both verified generations with the same content and meaning. The command preserves existing historical snapshot bodies; it creates no new body copies.

**Pre-V3 `request-header-system` Trace references are not converted into V4 system-message references.** If an affected record contains one, the upgrade refuses before publishing any plugin changes. Missing history, unsupported formats, incomplete mappings, changed identities/hashes, inconsistent record versions, malformed logs, and conflicting backups likewise refuse. Keeping an unconverted historical reference can yield `format-mismatch` or another explicit unavailable state in a V4 Host; no current resource is substituted for historical text.

Before the first replacement, every changed plugin file is backed up byte-for-byte as `<filename>.pre-v4-coordinates`. Existing backups are retained and never overwritten with different content. Source, target, and child logs are checked for changes, and plugin inputs are checked again before replacement. No card, preset, DSH log, or unrelated plugin data is rewritten.

Publication uses a temporary file and atomic rename for each file, not a transaction across files. After interruption, keep DSH stopped and rerun the same manifest: completed V4 records are skipped and remaining files resume. A backup conflict needs evidence-based manual resolution. After completion, restart the Host and verify historical reads, Trace, swipes, and branches.

## Verification and authority

```sh
DSH_TAVERN_COMPAT_ROOT=/path/to/dsh-install node --test test/coordinate-migration-integration.test.mjs test/dsh017-host-migration.test.mjs
DSH_TAVERN_PROMPT_COMPAT_ROOT=/path/to/dsh-install node --test test/trace-v3-host.test.mjs test/trace-failures-host.test.mjs
```

These checks use official modules with temporary histories and synthetic model responses. They cover historical format chains, interrupted-turn insertion, child evidence, cold Trace body/error reads, refusal, retained bytes, and reruns. They do not establish browser, desktop, real-provider, or user-profile acceptance; use the [verification guide](TESTING_en.md) for those environments.

Upstream authority: [immutable target release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.1), [V3→V4 specification](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/session/session-format-v3-to-v4/README.md), and [Session format catalog](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/packages/session/session-format-catalog/README.md).

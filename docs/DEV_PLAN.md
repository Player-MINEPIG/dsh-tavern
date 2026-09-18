# Current development and release plan

Current candidate: Tavern `2.3.0` on `codex/trace-api-v3`. The implementation targets
DSH `0.1.5-rc.1`; it has not been merged, tagged or released. Package versions and
current contracts describe this candidate, not a previously published release.

## Product and integration boundaries

- DSH owns durable Session history, model execution, tools, workspaces and native UI.
  Tavern uses public controllers, events and slots; removal leaves native Sessions usable.
- v1 exposes resources, bindings, configuration and the compatible audit view. v2
  exposes RP workflow primitives. v3 exposes three read-only assembly Trace primitives.
  See the [API scope](API_en.md#api-scope).
- The loader follows preset order and contributes named official sections. Generated
  identity wrappers are absent from model text; provenance and requested ST roles stay
  metadata. This does not add arbitrary ST message-role or depth placement.
- New Trace captures share one schema-4 metadata/reference record between v1 and v3.
  Detail reads verify official history without activating an Agent or reassembling
  current resources. Old Trace files remain read-only compatibility inputs.
- RP timelines store history references and display metadata. Greetings, imported QA
  and display overrides do not become fabricated DSH messages. Rendering and imported
  context retain the trust boundaries described in [SECURITY](../SECURITY_en.md).

## Implementation and verification

The Trace implementation, UI, metadata store, official-history reader and bilingual
contracts are complete. The [Trace acceptance guide](TRACE_REVIEW_en.md) records the
current automated and target-runtime results and the outstanding maintainer checks.
[Playthrough acceptance](PLAY_REVIEW_en.md) covers RP lifecycle and failure boundaries.
The [Trace backlog](TRACE_BACKLOG.md) tracks remaining work for this candidate.

Use Node compatible with the target Host: `^22.19.0 || >=24.0.0` for DSH 0.1.5-rc.1.
Tavern's standalone Node `>=20` declaration does not override the Host requirement.
The retained 0.1.2-rc.1 code path is not evidence that the new Trace flow was accepted
on that older Host. Follow the [migration guide](DSH_0.1.5_MIGRATION_en.md) for old
workspace coordinates and missing Session logs.

## Remaining release work

1. Complete maintainer acceptance with representative cards/presets, the third-party
   prompt manager and real-model cancellation/timeout/retry combinations.
2. Resolve any findings and rerun checks proportionate to the affected behavior.
3. Verify the exact candidate package and installation against the supported runtime;
   update the acceptance results when implementation changes.
4. Obtain maintainer approval before merging, tagging or publishing. Existing branch
   pushes do not imply release approval.

## Documentation maintenance

Product and technical pages describe the current implementation in place. Replace
obsolete descriptions instead of appending dated corrections. Keep paired languages
consistent. Acceptance pages hold one current result and the remaining checks;
backlogs hold current work, not completed commit ledgers. Version history belongs in
[CHANGELOG](CHANGELOG.md); older full documentation is available at its matching Git tag.
Private plans, workstation paths, credentials and user conversations stay outside
public documents. This development plan is not included in the published package.

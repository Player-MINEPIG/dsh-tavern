# Source authority

Use this reference when the task needs release status, development intent, or reconciliation of conflicting sources.

| Claim | Evidence |
| --- | --- |
| Released product | Published artifact, or a project-designated release corroborated by its matching tag and documents |
| Public development | Public remote `main` at an identified SHA |
| Current implementation | Task branch or worktree code and tests |
| Active intent | Applicable development-plan decisions; label proposals as proposals |

An immutable tag is an evidence snapshot unless the project designates it as a release. If a claim requires remote state and it cannot be checked, identify the local ref and its possible staleness; ordinary local edits do not require remote verification.

Plans describe intent; code and tests show implementation. Archived or older-version material is historical context unless a current decision adopts it. Documentation and local-record placement follow [AGENTS.md](../../../../AGENTS.md#documentation); reusable verification procedures are in [TESTING.md](../../../../docs/TESTING.md).

When relevant sources disagree, identify the refs, files, and behavioral difference. Reconcile within the requested scope without treating stale prose as implementation fact or accidental behavior as an approved design. Private-plan access and publication boundaries follow [AGENTS.md](../../../../AGENTS.md).

## Release consistency

Guidance-only or explanatory documentation changes do not by themselves require a product version bump. Commit them through the active workflow; the development branch may advance beyond the last release. Decide versioning from changes to product behavior, public contracts, or installable artifacts rather than diff size.

Preserve published tag targets and release assets as the released snapshot. Later documentation enters a future release tag; do not move an existing tag to make it follow the branch. Release-note wording or links may be corrected within the authorized scope without implying that the tagged code changed.

When publishing, reconcile the package and lockfile versions, tag commit, published Release state, and version-pinned installation instructions and announcement links. Verify each external action before reporting completion. Keep the source commit, relevant installed-build identity, environment, validation scope and gaps, and delivery links in a local record. Existing validation remains usable when its affected implementation and environment still match; rerun checks justified by subsequent changes or unresolved gaps, rather than repeating runtime checks for guidance-only edits.

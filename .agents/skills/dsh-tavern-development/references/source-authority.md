# Source authority

Use this reference when the task needs release status, development intent, or reconciliation of conflicting sources.

| Claim | Evidence |
| --- | --- |
| Released product | Published artifact, or a project-designated release corroborated by its matching tag and documents |
| Public development | Public remote `main` at an identified SHA |
| Current implementation | Task branch or worktree code and tests |
| Active intent | Applicable development-plan decisions; label proposals as proposals |

An immutable tag is an evidence snapshot unless the project designates it as a release. If a claim requires remote state and it cannot be checked, identify the local ref and its possible staleness; ordinary local edits do not require remote verification.

Plans describe intent; code and tests show implementation. Archived or older-version material is historical context unless a current decision adopts it. Reusable verification procedures belong in [TESTING.md](../../../../docs/TESTING.md). Run-specific acceptance records, plans, release announcements and issue reply drafts stay local under Git-ignored `.local/`; do not add them to public documentation or package contents. Current-facing documents describe the current implementation in place; use matching Git tags for older documentation and root [CHANGELOG.md](../../../../CHANGELOG.md) for version history.

When relevant sources disagree, identify the refs, files, and behavioral difference. Reconcile within the requested scope without treating stale prose as implementation fact or accidental behavior as an approved design. Private-plan access and publication boundaries follow [AGENTS.md](../../../../AGENTS.md).

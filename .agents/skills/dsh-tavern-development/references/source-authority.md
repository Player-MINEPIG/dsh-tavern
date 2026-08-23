# Source authority

Use distinct evidence for distinct claims:

| State | Authority |
| --- | --- |
| Released product | Published package or artifact, or a project-designated release corroborated by its matching release tag and documents |
| Public development | Public remote `main` at an identified SHA |
| Current implementation | The task's branch or worktree code and tests |
| Active intent | Applicable development-plan decisions, with proposals labeled as proposals |

Other immutable tags are evidence snapshots, not releases unless the project explicitly designates them as such. Do not call public `main` or an arbitrary tag “released” without matching release evidence. If remote state cannot be checked, name the exact local ref and SHA and say it may be stale.

Read a private development plan only when it is provided as an explicit workspace root. Otherwise work from the public repository and do not guess adjacent, parent, home-directory, remembered, or remote-private paths.

Development documents define intent and constraints; branch code and tests define implemented behavior. Documents can lag. Archived, legacy, superseded, or older-version material is context unless a current decision adopts it.

When sources disagree, report the exact refs, files, and behavior. Do not let stale prose override implementation facts or accidental code silently override an explicit project decision. Update documents only when the task authorizes reconciliation.

Promote only finalized external contracts or concise public rationale. Never copy private-plan prose, links, repository coordinates, user data, or local paths into the public repository without explicit approval.

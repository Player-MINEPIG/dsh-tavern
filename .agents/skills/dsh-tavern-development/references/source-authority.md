# Source authority and development-plan discovery

Use this reference to establish what is public, what is under active development, and what is merely proposed.

## Discover only inside the workspace

Treat the workspace roots supplied by the environment as the complete discovery boundary.

1. Identify the public `dsh-tavern` repository from its Git root and `package.json` name.
2. Search only those workspace roots for a development-plan root. A likely root has a README declaring itself a dsh-tavern development-plan repository and usually contains `in-progress/`, `archive/`, or `legacy/`.
3. Do not ascend to parent directories, scan the home directory, guess sibling paths, follow a remembered absolute path, or search a remote for a private development plan.
4. If no development-plan root is present, continue in public-only mode. State that active private plans were unavailable when that limitation affects the result. Ask the user to add the folder to the workspace only when the current task genuinely requires unpublished decisions.

A subagent working in a managed project worktree follows the same boundary for its own environment. The parent agent should extract and pass the minimum relevant decisions to the subagent; the subagent must not crawl back to the original checkout or its parent directories.

## Establish the baselines

### Released and public state

Treat the actual remote `main` of the public repository as the released baseline, not an assumed local branch name or a possibly stale remote-tracking ref.

- Inspect the configured remote and compare its `main` SHA with the local refs when network access is available.
- Fetch read-only public state when needed and permitted; do not merge, reset, or overwrite the current worktree merely to inspect it.
- If remote access is unavailable, identify the exact local ref and SHA being used and disclose that it may be stale.
- Public documentation at that baseline defines the external contract and released product claims.

### Active development state

For work in progress, use the relevant development-plan documents together with the corresponding branch or worktree code.

- Development documents define current intent, constraints, accepted decisions, and unresolved questions.
- Branch/worktree code and tests define what is actually implemented on that development line.
- A document marked archived, legacy, superseded, or accepted for an older version is context, not automatically a current requirement.
- Documentation may lag code. Never claim a planned feature is implemented without code or test evidence.

## Resolve conflicts explicitly

Use the source appropriate to the claim:

| Question | Primary evidence |
| --- | --- |
| What can public users rely on now? | Public remote `main` code and public documents |
| What does an active branch currently do? | That branch/worktree code and focused tests |
| What is the intended next design? | Current development-plan decision or proposal, clearly labeled |
| What constraints should implementation follow? | Current applicable documents, until the user approves a revision |
| Was a decision finalized for release? | Matching code plus updated public and development documentation |

When sources disagree, report the exact files, refs, and behavior involved. For implementation facts, do not let stale prose override observed code. For project intent, do not silently let an accidental implementation override an explicit decision. Reconcile the mismatch with the user or update the stale document when the requested task already authorizes that synchronization.

## Keep private context private

- Never copy private development-plan prose, links, repository coordinates, user data, or local paths into the public repository unless the user explicitly approves publication of that exact material.
- Promote only the stable external contract or a concise public rationale.
- Use repository-relative paths in committed files.
- Before committing, review added lines for home-directory paths, drive letters, usernames, hostnames, tokens, credentials, private remotes, and fixture data derived from real users.

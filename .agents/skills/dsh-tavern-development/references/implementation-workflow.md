# Branch, worktree, delegation, and commit workflow

Use this reference for any task that changes repository files.

## Preflight

1. Inspect the current branch, HEAD, worktree list, status, and relevant remotes.
2. Preserve unrelated tracked and untracked changes. Do not clean, reset, checkout, stash, or rewrite user work to obtain a clean tree.
3. Continue in an already assigned task branch/worktree. If a modifying task starts on `main` and no task branch was assigned, create a narrowly named `codex/<topic>` branch unless the user explicitly asked to work in the current checkout.
4. Identify the owning package and the smallest relevant tests and documents before editing.

## Decide whether parallel delegation is valid

Delegate only when the task can be split into at least two simple atomic modules that satisfy all of these conditions:

- Each module has a precise input, output, file ownership boundary, and verification command.
- Modules can finish independently without one consuming another's uncommitted work.
- Agents will not edit the same files or compete for shared generated output.
- Integration is a reviewable combination of commits rather than an unresolved design decision.

If any condition fails, the root agent implements the task serially. Do not invent busywork solely to create parallelism.

## Run valid modules in isolated worktrees

When the runtime supports binding subagents to distinct managed worktrees:

1. Give every atomic module its own branch and managed worktree.
2. Use `gpt-5.6-luna` with high reasoning for these simple implementation modules when that model is available. If it is unavailable, keep the work with the root agent rather than silently substituting another model.
3. Delegate a bounded specification containing allowed files, required behavior, applicable public contracts, the minimum relevant development-plan decisions, verification commands, and the requirement to commit the completed module.
4. Require each subagent to avoid remote mutations and to report its branch, commit, tests, assumptions, and remaining risks.
5. Have the root agent review each diff and verification evidence before integrating the commits and running combined tests.

Do not share one writable checkout among parallel implementation agents. If the runtime cannot provide distinct worktrees, work serially.

### Worktree location

- Prefer Codex-managed worktrees. Their storage root is controlled by Codex settings and must not be inferred from the repository's parent directory.
- Never manually choose `../<project>-<topic>` or another sibling path merely because it is a common Git convention.
- If a persistent manual worktree is genuinely required, create it only under a user-configured worktree root that is already an allowed workspace root. Otherwise ask the user.
- Do not nest worktrees inside the public repository: they pollute searches, builds, packaging, and status unless every tool is carefully excluded.

## Implement and verify

- Make the smallest coherent change that satisfies the accepted contract.
- Use public DSH seams. If the public API cannot express the requirement, stop and discuss the missing contract rather than reaching for private DOM or undocumented internals.
- Add or update tests for observable behavior. Avoid wording-only tests that freeze implementation details without protecting a contract.
- Update active development documentation as decisions evolve. Promote finalized externally relevant behavior to the public documents in the same change or an explicitly linked follow-up.
- Run focused tests first, then the repository-level checks appropriate to the affected contract.

## Commit checkpoints

Commit after each coherent completed change so the work remains recoverable.

Before every commit:

1. Confirm the relevant tests pass.
2. Review `git status`, the staged diff, and the staged file list.
3. Remove generated caches, local configuration, absolute paths, secrets, private-plan content, and unrelated edits from the commit.
4. Use a message that names the completed behavior, not the activity performed.

Do not leave a completed requested change only in the working tree. Do not create empty checkpoint commits for unfinished code unless the user explicitly requests work-in-progress snapshots.

## Remote boundary

Commits are authorized as local recovery points. They do not authorize remote mutation.

Without explicit user permission, do not:

- push any branch or tag;
- open or update a pull request;
- publish an npm package or other artifact;
- create a GitHub release;
- modify remote branch protection, issues, or project state.

Finish by reporting the local branch, commit SHA, verification performed, files or contracts changed, and anything still requiring user decision.

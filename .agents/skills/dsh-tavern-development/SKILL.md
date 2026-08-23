---
name: dsh-tavern-development
description: Develop, diagnose, review, or document pmp-dsh-tavern while preserving its public contracts, active design decisions, Git isolation, and release boundaries. Use for repository implementation and maintenance work; do not use for ordinary end-user usage questions that require no repository analysis or change.
---

# DSH Tavern Development

Use this workflow for work in the `pmp-dsh-tavern` repository. Keep released behavior, active development intent, and experimental proposals visibly distinct.

## Route the task

1. Read [source authority](references/source-authority.md) before deciding what is current, comparing released and development behavior, or consulting a development-plan workspace.
2. Read [implementation workflow](references/implementation-workflow.md) before modifying files, delegating modules, creating branches or worktrees, committing, or preparing a release.
3. Read only the public documents relevant to the requested surface:
   - `README.md` and `docs/USAGE_zh-CN.md` for product behavior.
   - `docs/ARCHITECTURE.md` and `docs/LOADER_CONTRACT.md` for ownership, layering, lifecycle, and session-selection constraints.
   - `docs/API.md` and `docs/FRONTEND_INTEGRATION_zh-CN.md` for stable HTTP and third-party frontend contracts.
   - `docs/DSH_MESSAGE_FLOW.md` and `docs/PROMPT_PIPELINE.md` for message, prompt, activation, and world-book behavior.
   - `SECURITY.md` and `docs/RP_SECURE_MODE.md` for trust and permission boundaries.
   - `docs/PLAY_REVIEW.md` for accepted 2.0 behavior and regression evidence.

## Preserve the current project contract

Treat the documented principles below as the current baseline, not as immutable doctrine:

- DSH durable session history remains authoritative. Greeting, display regex, imported context, and Tavern timelines must not silently rewrite or impersonate it.
- Prefer documented DSH services, slots, events, stores, and Remote/API seams. Do not bridge missing capability with private DOM, hashed classes, or undocumented internal stores.
- Keep Host-owned shared state, agent-local behavior, and client presentation responsibilities explicit. Agent scope is routing, not a security sandbox.
- Preserve native-mode reachability, uninstall fallback, third-party coexistence, unknown SillyTavern fields, and fail-closed behavior when RP state cannot be classified safely.
- Configuration may select installed executable providers; it must not download or execute arbitrary code as ordinary data.

If a materially better solution conflicts with one of these principles, identify the exact conflict, explain the benefit and migration cost, and discuss it with the user. Do not reject the solution merely because it conflicts, and do not silently revise the principle. Once a decision is final, update the appropriate development record and the public contract that external users rely on.

## Work to evidence

- Confirm behavior from the corresponding branch or worktree code and focused tests; documentation can lag implementation.
- Keep design claims scoped to what is implemented. Label research, proposals, and later-version architecture as such.
- Reproduce bugs before fixing them and add regression evidence at the narrowest stable boundary.
- Prefer minimal changes inside the owning package. Respect the dependency direction documented in `docs/ARCHITECTURE.md`.
- Run checks proportional to the change. Use focused Node tests during iteration, `npm test` for broad logic changes, `npm run check` for build plus tests, and `npm run verify:2.0` when the 2.0 protocol, package contents, or release contract may change.

## Finish cleanly

- Synchronize changed behavior with the relevant Chinese and English public documents when both are maintained.
- Inspect the final diff for secrets, imported user data, private development-plan material, machine hostnames, and absolute local paths.
- Commit each coherent completed change after its relevant verification. Keep unrelated user changes untouched.
- Never push, publish a package, create a tag or release, open a pull request, or otherwise mutate a remote without explicit user permission.

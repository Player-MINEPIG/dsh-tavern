---
name: dsh-tavern-development
description: Develop, diagnose, review, or document pmp-dsh-tavern using versioned DSH contracts, separated public and active-development sources, and project-specific validation. Use for repository implementation and maintenance work; do not use for ordinary end-user usage questions that require no repository analysis or change.
---

# DSH Tavern Development

Use this skill for project knowledge specific to `pmp-dsh-tavern`. Keep released artifacts, public `main`, the current task branch, active development plans, and proposals visibly distinct.

## Responsibility

This skill supplies DSH Tavern source authority, architecture contracts, DSH-version compatibility rules, and validation commands. Leave general scope control to `stop-that-shit` and general fault diagnosis to `systematic-debugging`; do not duplicate or enlarge their workflows here.

## Read the relevant sources

- Read [source authority](references/source-authority.md) before deciding what is released, public, implemented, planned, or proposed.
- Read [DSH compatibility](references/dsh-compatibility.md) for any change or claim involving DSH versions, public seams, Host/client lifecycle, installation, or runtime Node support.
- Route product behavior to `README.md` and `docs/USAGE_zh-CN.md`; architecture and lifecycle to `docs/ARCHITECTURE.md` and `docs/LOADER_CONTRACT.md`; HTTP/frontend contracts to `docs/API.md` and `docs/FRONTEND_INTEGRATION_zh-CN.md`; message/prompt behavior to `docs/DSH_MESSAGE_FLOW.md` and `docs/PROMPT_PIPELINE.md`; trust boundaries to `SECURITY.md` and `docs/RP_SECURE_MODE.md`; accepted 2.0 evidence to `docs/PLAY_REVIEW.md`.

## Current architectural baseline

For the currently recorded DSH and Tavern versions, the project presently aims to:

- Keep DSH durable session history authoritative.
- Integrate through public seams of the target DSH version.
- Keep native DSH usable and original sessions readable after Tavern is removed.

These are current design decisions, not permanent invariants. Preserve them during ordinary maintenance, but do not use them to reject a materially better design. If a proposed change conflicts with any of them, identify the affected external behavior, compatibility and migration cost, discuss the tradeoff with the user, and record the authorized decision in the applicable development records, public contracts, and verification.

## Work and remote boundaries

- Always preserve the user's existing modifications. Use branches, worktrees, and commits only when the task requests them or the active project workflow requires them.
- Never copy private development-plan content, repository coordinates, user data, or absolute local paths into the public repository without explicit approval.
- Never push, publish, create a tag or release, or open or update a pull request without explicit user permission.

Report the outcome and verification or evidence used. When files changed, report what changed and why. Report affected contracts, DSH or Node refs, omitted integration checks, risks, open decisions, and a commit SHA only when they materially affect the task or confidence in the result.

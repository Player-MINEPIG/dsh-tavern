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

## Stable core contract

- DSH durable session history remains authoritative.
- Integrate only through public seams of the target DSH version.
- Removing Tavern must leave native DSH usable and its original sessions readable.

Treat other documented project principles as current constraints, not immutable doctrine. If a materially better approach conflicts with one, identify the conflict and discuss the tradeoff with the user instead of rejecting it or silently changing the principle. Record finalized decisions in the appropriate development and public documents.

## Work and remote boundaries

- Always preserve the user's existing modifications. Use branches, worktrees, and commits only when the task requests them or the active project workflow requires them.
- Never copy private development-plan content, repository coordinates, user data, or absolute local paths into the public repository without explicit approval.
- Never push, publish, create a tag or release, or open or update a pull request without explicit user permission.

Every delivery, whether committed or not, reports what changed and why, affected contracts, the DSH version or ref used, checks run and omitted, assumptions/risks/open decisions, and the commit SHA when one exists.

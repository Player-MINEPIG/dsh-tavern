# Project Guidelines

This file records project-specific guidance. General scope control, debugging, review, and skill maintenance belong to applicable global skills, used according to their own triggers. This project does not require installing or loading them for every task.

For project contracts, DSH version compatibility, or release evidence, use the topic links in the [development skill](.agents/skills/dsh-tavern-development/SKILL.md).

## Project Boundaries

- Preserve the current architecture during ordinary maintenance: DSH durable history is authoritative, integration uses public DSH extension points, and native DSH and original sessions remain usable after Tavern is removed. When changing these decisions, explain the external behavior, compatibility, and migration costs, then implement the user-approved decision.
- Use branches, worktrees, and commits as requested by the user or required by the active project workflow. Pushes, PRs, tags, and releases require explicit user authorization.
- Read private development plans only when explicitly provided as a workspace. Without explicit approval, do not copy private-plan content, repository coordinates, user data, or absolute local paths into the public repository.
- Installation, uninstallation, migration, and data writes against real DSH profiles must fall within the task's authorization. Ordinary code changes do not automatically authorize these operations.

## Validation by Change Scope

Local builds and tests using temporary directories and fixtures, including fixes and reruns for failures caused by the requested change, may proceed without step-by-step confirmation.

Command definitions live in [package.json](package.json). Select according to the affected behavior:

| Change scope | Validation |
| --- | --- |
| Documentation only | Check content, links, and diff; no build or test suite needed |
| Localized logic | `node --test test/<relevant-file>.test.mjs` |
| Cross-module behavior | `npm test` |
| Client bundle changes | Relevant tests and `npm run build`; `dist/client.js` is generated |
| Full build and test coverage needed | `npm run check` |
| Protocol, installation/package contents, or release preparation | `npm run verify:2.0`, plus runtime acceptance appropriate to the task |

For DSH integration changes, see the [compatibility reference](.agents/skills/dsh-tavern-development/references/dsh-compatibility.md) for real Host, browser, and migration checks and what they establish.

<!-- Rationale: https://x.com/pvncher/status/2095991462416490862. Keep persistent guidance concise and load topic-specific details on demand. -->

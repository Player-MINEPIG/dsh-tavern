---
name: dsh-tavern-development
description: Use for DSH Tavern repository work needing project contracts, version-specific DSH integration, or release evidence.
---

# DSH Tavern Development

Use project-specific evidence for the requested change. Shared architecture, completion criteria, permissions, and local validation commands live in [AGENTS.md](../../../AGENTS.md).

## Read only what the task needs

- Release status, development plans, or conflicting sources: [source authority](references/source-authority.md).
- DSH APIs, Host/client lifecycle, installation compatibility, or runtime support: [DSH compatibility](references/dsh-compatibility.md).
- Product behavior: [README](../../../README.md) and [usage](../../../docs/USAGE_zh-CN.md).
- Architecture and lifecycle: [architecture](../../../docs/ARCHITECTURE.md) and [loader contract](../../../docs/LOADER_CONTRACT.md).
- HTTP or frontend interfaces: [API](../../../docs/API.md) and [frontend integration](../../../docs/FRONTEND_INTEGRATION_zh-CN.md).
- Message or prompt behavior: [DSH message flow](../../../docs/DSH_MESSAGE_FLOW.md) and [prompt pipeline](../../../docs/PROMPT_PIPELINE.md).
- Prompt Trace, historical provenance, or v3 consumers: [Prompt API v3](../../../docs/PROMPT_API_V3.md).
- Automated, Host, browser, or external integration acceptance: [developer verification](../../../docs/TESTING.md).
- Trust boundaries: [security](../../../SECURITY.md) and [RP secure mode](../../../docs/RP_SECURE_MODE.md).

These are topic entry points, not a reading checklist. Small edits can use the affected file and nearby evidence directly.

For API changes, distinguish current resources/configuration, runtime assembly, and historical assembly records; also distinguish source-field originals from assembled text. Check the linked contracts before proposing overlapping endpoints or treating one representation as another.

Use **装配 / assemble / assembly** for prompt preparation in explanations and documentation. Preserve actual code identifiers such as `compilePresetForDsh` when referring to implementation.

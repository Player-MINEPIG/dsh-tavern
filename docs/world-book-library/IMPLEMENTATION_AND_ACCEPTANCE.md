# Standalone World Book implementation and acceptance

Status: implemented on the standalone-world-books feature branch for parent-task review. This document does not claim merge or publication.

## Scope and boundaries

`packages/world-book-library` owns independent World Info documents, their HTTP management surface and their browser editor. It imports the pure `packages/world-book` format model but contains no DSH Host hooks. `packages/tavern-loader` creates the store, owns session selections and is still the only layer that registers system prompt and request hooks.

The combined browser surface retains editing for the selected character card's embedded `character_book` through the existing character API. That data lifecycle remains character-owned; the independent store never writes it.

```text
JSON import / editor
        │
        ▼
world-book-library store + API
        │ selected document snapshots
        ▼
loader-owned session policy ── worldBookIds[]
        │
        ▼
one world-book adapter
  ├─ selected standalone books
  ├─ selected user's bound standalone books
  └─ selected character's embedded book
        │
        ▼
shared parser → matcher → loader projection → Tavern profile
```

No store or API code was added to the pure parser/matcher package. The resource layer does not register `systemPrompt.section`, handle `agent/request`, inspect DSH sessions or compile final prompts.

## Data lifecycle

- Documents are stored as mode-`0600` JSON files under the plugin data directory's `world-books/` child.
- Imports and writes are bounded to 4 MiB and use same-directory temporary files followed by atomic rename.
- Before normalization, standalone and embedded books share an iterative structure guard: at most 10,000 entries, depth 32, 100,000 traversed nodes, 1 MiB per string, and 1,024 characters per object key. The loader adapter separately caps the aggregate standalone/user/embedded matcher input at 10,000 entries and skips later overflowing resources with a diagnostic, so it never traverses an unbounded collection before the compiler's 4,096-candidate limit.
- A document records its stable id, timestamps, source format/file metadata, SHA-256 and normalized `WorldBookModel` including the original raw source snapshot.
- Update requests may change only modeled book settings and entry fields. Unknown top-level, entry and extension fields come from the saved raw snapshot and survive subsequent export.
- New entries receive non-integer object-map keys (`entry-...`) so JavaScript's integer-key enumeration cannot reorder existing entries after reload.
- Delete removes only the independent document. The loader's resource cleanup removes that id from every `worldBookIds` selection; character selection and embedded `characterBook` data are outside the operation.
- Plugin refresh/uninstall/backup behavior follows the existing shared data-directory lifecycle. Runtime data is excluded from the npm package.

## HTTP surface

| Method and path | Behavior |
| --- | --- |
| `GET /dsh-tavern/api/world-books` | List safe catalog summaries |
| `POST /dsh-tavern/api/world-books` | Create an empty standalone ST book |
| `POST /dsh-tavern/api/world-books/import` | Import bounded ST World Info or Character Book JSON |
| `GET /dsh-tavern/api/world-books/:id` | Read the normalized editable document |
| `PATCH /dsh-tavern/api/world-books/:id` | Persist known modeled edits while retaining unknown raw fields |
| `GET /dsh-tavern/api/world-books/:id/json` | Export JSON in the imported source format |
| `DELETE /dsh-tavern/api/world-books/:id` | Delete the independent document and clear its selections |
| `GET/POST /dsh-tavern/api/world-book-selection` | Read or replace one session's ordered `worldBookIds` |

All routes remain behind the existing loopback Host, same-origin mutation, JSON media-type and defensive response-header wrapper. Ids are filename-safe; session ids use the loader's bounded allowlist. Catalog responses do not expose storage paths.

## Runtime semantics

The adapter resolves explicit session books in saved selection order, appends the selected user's bound standalone books in their saved relationship order, deduplicates shared ids, and finally resolves the selected character's embedded book. Each model is scanned through the existing bounded-history function and `computeWorldBookCandidates()`. Entry insertion order, secondary logic, group/probability policy and token budget therefore have one implementation for every source. Loader projection remains responsible for exact before/after mapping, explicit approximation diagnostics and outlet omission.

The combined World Book sidebar exposes these as three visually separate sources: editable explicit session bindings, editable current-user bindings, and the character-bound embedded book editor. The World Book and User panels deliberately edit the same loader-owned user/world-book relationship through the same API, so either entry point persists one authoritative value and refreshes the other. Each selected user book also opens the canonical standalone document editor in the same sidebar; this edits the original resource rather than creating a source-specific copy. The World Book panel identifies the current user, ordered inherited book names, pending changes, session duplicates and the effective ordering rule.

Native regular-expression keys are disabled unless explicitly opted in; recursive/stateful effects and vector matching remain deferred; and positions unsupported by DSH are explicitly approximated. Matching combines bounded durable history with the current step's claimed input before system assembly, so a single-step session can activate a book on its first request without creating an artificial empty step or durable message.

## Automated acceptance

The repository tests cover:

- import/create/edit/delete plus a fresh store instance reload;
- stable preservation of synthetic unknown book and entry fields;
- export in source format and safe non-integer keys for new object-map entries;
- bounded API parsing, missing-resource rejection and unsafe session rejection;
- zero/one/many ordered selection storage and cross-session isolation;
- binding and unbinding effects on the next loader compilation;
- deterministic insertion-order output and existing explicit budget/probability tests;
- simultaneous standalone and character-embedded matching through one adapter;
- deletion cleanup leaving the bound character's embedded book active;
- architecture checks that keep filesystem/API code out of the pure world-book package.

Final verification on 2026-08-15:

- `npm run check`: browser bundle built; 91 tests discovered, 90 passed, 0 failed and the optional reviewer-supplied external-fixture test skipped because its environment variable was not set.
- `npm run pack:check`: succeeded with 39 release files; the new store/API/client sources and generated client bundle are included, while tests, docs, runtime data, local caches and fixtures are excluded.
- Architecture, local-path, local-roadmap-name, user-name, private-key and common credential-shaped scans returned no feature-introduced finding.
- The only fixture added by this module is the minimal self-authored `Synthetic Library Book`; no third-party preset, character card or world book was read or copied.

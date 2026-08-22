# WorldBookModel design and interface contract

[中文](DESIGN.md)

Status: adopted 2026-08-14 and implemented by the first public release candidate's shared parser/matcher/loader adapter.

## Module boundary

The pure module lives in `packages/world-book` and uses only JavaScript platform capabilities. It does not import DSH, the Node filesystem, UI, network, preset, or `tavern-loader`. The root package exports it at the `pmp-dsh-tavern/world-book` subpath. The only installable plugin is still the root package.

```text
ST world JSON ───────────┐
                        ├─ format.js ─> WorldBookModel ─> ST world JSON
card.data.character_book┘                         └──────> character_book

WorldBookModel + scan text + explicit policy inputs ─> policy.js candidate advice
```

`format.js` answers “what does the file express”. `policy.js` only answers “given complete inputs, which entries may be candidates”. Session selection, source composition, a real tokenizer, recursive state, and prompt injection are all left to the unified loader.

## WorldBookModel v1

The model top level always contains:

- `schemaVersion: 1`, `kind: "world-book"`;
- `name`, `description`;
- `settings`: book-level scan depth, token budget, recursive scanning, and the original extension object;
- `entries[]`: unified fields;
- `source`: source format, original entry-container type, and the complete original book object;
- `diagnostics[]`: structured diagnostics.

Unified entry fields cover key, secondary key, enablement, strategy, secondary logic, insertion order/position/depth/role, probability, scan override, grouping, recursion, timing, filters, triggers, and extensions. Each entry's `source.raw` keeps the complete original object. `source.key` keeps the mapped key from a standalone ST world book.

The model does not generate UUIDs, timestamps, or random values. The same JSON and the same options must produce a deeply equal model.

## Recognition and validation

- `entries` is a non-array object: `sillytavern-world-info`.
- `entries` is an array: `character-book-v2`.
- Missing `entries`, a non-object top level, or a non-object entry: error; parse throws `WorldBookValidationError`.
- Missing or mistyped entry fields that can degrade safely: warning, and ST/spec defaults are used.
- Duplicate normalized UID: warning. Array order and source key can still distinguish entries. Nothing is deleted silently.

`validateWorldBook()` does not throw ordinary format errors. It returns `{ valid, format, diagnostics }`. `parseWorldBook()` throws on error diagnostics and attaches the diagnostics to the exception.

## Stable import/export

Export starts from `source.raw` / each entry's `source.raw`, then overlays supported semantic fields from the model. Therefore:

- Unknown top-level fields, unknown entry fields, and book/entry extensions are kept;
- Conversion between the two target formats is possible;
- Re-import/export is structurally idempotent;
- `stableStringify()` recursively sorts object keys so snapshots and cross-process output are stable.

“Original retention” is not a byte-level round trip. Parsed JSON no longer keeps whitespace, escape spelling, or duplicate object keys. Normalized export may also fill default fields.

## Character-card module interface

The character-card module should pass values only and must not create a reverse dependency:

```js
const model = parseCharacterBook(card.data.character_book, {
  name: card.data.character_book?.name ?? `${card.data.name} lorebook`,
})

const embedded = exportCharacterBook(model)
nextCard.data.character_book = embedded
```

This module does not receive a PNG, a whole card, or a character session, and it does not decide whether the embedded book is enabled. The character-card module extracts/writes back. The loader owns source priority and selection.

## Loader consumption contract

The unified loader may:

1. Obtain one or more already-selected `WorldBookModel`s from an upper layer;
2. Assemble scan text and source priority from its own session/context;
3. Optionally call `computeWorldBookCandidates()` for stateless advice;
4. Handle tokenizer, recursion, sticky/cooldown/delay, random probability, group lifetime, and final insertion position itself;
5. Not depend on `source.raw` to interpret already-normalized fields.

The candidate function returns accepted/rejected plus reasons. It never generates a system prompt directly.

## Public API

Root-package subpath: `pmp-dsh-tavern/world-book`.

- `detectWorldBookFormat(input)`: recognize by the shape of `entries`; does not throw JSON/structure errors;
- `validateWorldBook(input, options)`: returns format, valid, and structured diagnostics;
- `parseWorldBook()`, `parseSillyTavernWorldBook()`, `parseCharacterBook()`: produce a model;
- `exportSillyTavernWorldBook(model)`, `exportCharacterBook(model)`: export a JSON value;
- `stableStringify(value, space)`: produce JSON text with recursively stable keys;
- `matchWorldBookKey()`, `evaluateWorldBookEntry()`, `rankWorldBookEntries()`: composable pure functions;
- `computeWorldBookCandidates(modelOrEntries, options)`: accepts explicit text, default match settings, vector match, probability rolls, group rolls, token costs, and budget, and returns accepted/rejected/budget. It does not read context, roll randomness, or call a tokenizer by itself.
- `projectWorldBookForLoader(model, candidates, options)`: project one selected book's candidate result to `{ loreEntries, resources, diagnostics }`;
- `mergeWorldBookLoaderResults(results)`: merge projections of several selected books. Adds no selection or runtime policy.

All value inputs and returns are ordinary structured-cloneable data. The module has no file-read API.

## `registerWorldBookAdapter` bridge

The root loader already registers the management-layer adapter through `createWorldBookAdapter(worldBookStore, options)`. `resolve({ selection, worldBookSelection, agent, conversationText, activationContext, character })` is the use-case composition point: it reads standalone books for `selection.worldBookIds` in the stable order session-explicit → user-bound → preset-bound → character-bound, records each book's actual binding sources, then adds the card's embedded book to the same bounded match, projection, and merge. This pure module itself still does not register a Host seam and does not read those stores:

```js
loader.registerWorldBookAdapter(createWorldBookAdapter(worldBookStore, options))
```

An embedded `character_book` parsed by the character-card module also becomes the same `WorldBookModel` and enters the same matcher/projector. Matching must not be reimplemented.

The current loader has upgraded the pure-string compatibility input to a structured `activationContext`. That change did not enter this pure module. The management-layer adapter derives compatibility `conversationText` from `activationContext.text` and turns explicitly selected message frames into matcher `text`. `computeWorldBookCandidates()` still does not subscribe to `agent/inbox/spliced`, read Session, or save current input. Pending queue, claim/cancel semantics, body lifetime, and history de-duplication stay exclusive to `tavern-loader`.

First-step activation acceptance must check matcher decision, loader snapshot, and the same-step `request/header.system` together. Recomputing a “hit” from current input after the request is not a valid implementation.

The pure projector's position bridge stays honest:

| WorldBookModel position | loader lore position | Diagnostic |
| --- | --- | --- |
| `before_character_definition` | `before` | no degradation |
| `after_character_definition` | `after` | no degradation |
| before example / before author note | `before` | `WORLD_BOOK_POSITION_APPROXIMATED` |
| after example / after author note / at depth | `after` | `WORLD_BOOK_POSITION_APPROXIMATED` |
| outlet | no activated item returned | `WORLD_BOOK_OUTLET_SKIPPED` |

Each returned activated item is `{ id, uid, content, position: "before" | "after" }`. `id` uses `<resourceId>:<uid>` to avoid UID collisions across books. `uid` keeps the in-book original identifier. Empty content is not given to the loader and is diagnosed. The projector does not read `selection/sessionId/agent/character/context`. Ownership of those parameters stays with the adapter/loader.

# World book compatibility changelog

## 2026-08-14

- Added a deterministic `WorldBookModel` v1.
- Added SillyTavern standalone World Info object-map recognition, validation, normalization and export.
- Added Character Card V2 `character_book` array recognition, normalization and export.
- Preserved raw book/entry data, unknown top-level fields and unknown extensions.
- Added structured diagnostics and a typed validation error.
- Added stable JSON serialization and import/export idempotence coverage.
- Added optional pure matching, ranking, inclusion-group and budget candidate advice.
- Added a pure bridge from candidates to the loader adapter `{ loreEntries, resources, diagnostics }` contract, including honest position diagnostics.
- Added self-authored minimal fixtures, unit tests and a normalized model snapshot.
- Kept loader, session, UI, agent, network, filesystem and character-card responsibilities out of the module.

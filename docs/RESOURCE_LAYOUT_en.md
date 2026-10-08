# Resource positions and assembly result integration

[中文](RESOURCE_LAYOUT.md)

The standalone `dsh-prompt-assembler` owns position configuration. Tavern's `packages/request-assembler/resource-layout.js` reexports `normalizeLayout`, `describeResourceLayout`, `withBlockMove`, `positionRows` and `configurePosition` without duplicating assembly logic.

The editor has Resource positions and Assembly result pages. Configuration reads provider declarations for preset text categories, character/persona macros, worldbook positions and registered MVU/template injections. Empty positions remain switchable and sortable. Source parsing, roles and delivery settings expand on the same page. Results load current assets and explain content, provenance, final order and conflict decisions under the selected priority. Recorded actual requests retain a separate read-only action.

`layout.positions` persists source IDs, position IDs, switches and source-following/user-order choices, never asset IDs, activated entries or MVU revisions. Provider descriptors optionally declare `positions`, returned by the existing source catalogue. MVU currently provides standalone variable state and update instructions; variable values embedded in worldbook/template text follow the containing content.

`layout.priority` persists a user-reorderable list of user positions, preset slots, resource placement and source defaults. Native history, tool transactions and retention are explained separately and remain authoritative. New policies provide an editable initial list; existing choices are preserved. Preview and actual requests share resolution and ordering; native previews remain subject to delivery and context-snapshot reuse and do not claim to be sent requests. Older asset-specific overrides remain compatible and can be explicitly cleared.

The integrator must update the assembler dependency to a version exposing these APIs and regenerate the package lock and client bundle together. History filtering remains owned by the separate history-policy module. Validate with `node --test test/resource-layout-*.test.mjs`; full contracts, types and stock/core Host validation are in the assembler's `docs/RESOURCE_LAYOUT_en.md` and Chinese counterpart.

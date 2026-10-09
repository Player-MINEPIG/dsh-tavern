# Resource positions and assembly result integration

[中文](RESOURCE_LAYOUT.md)

The standalone `dsh-prompt-assembler` owns position configuration. Tavern's `packages/request-assembler/resource-layout.js` reexports `normalizeLayout`, `describeResourceLayout`, `withBlockMove`, `positionRows` and `configurePosition` without duplicating assembly logic.

The editor has Resource positions and Assembly result pages. Configuration reads provider declarations for preset text categories, character/persona macros, worldbook positions and registered MVU/template injections. Empty positions remain switchable and sortable. Source parsing, roles and delivery settings expand on the same page. Results load current assets and explain content, provenance, final order and sorting decisions under the selected priority. Recorded actual requests retain a separate read-only action.

`layout.positions` persists source IDs, position IDs, switches and source-following/user-order choices, never asset IDs, activated entries or MVU revisions. Provider descriptors optionally declare `positions`, returned by the existing source catalogue. MVU currently provides standalone variable state and update instructions; variable values embedded in worldbook/template text follow the containing content.

`layout.priority` persists a user-reorderable list of user positions, preset slots, resource placement and source defaults. Native history, tool transactions and retention are explained separately and remain authoritative. New policies provide an editable initial list; existing choices are preserved. Preview and actual requests share resolution and ordering; native previews remain subject to delivery and context-snapshot reuse and do not claim to be sent requests. Older asset-specific overrides remain compatible and can be explicitly cleared.

With the standard backend, Preserve source roles routes system content before history and user content into native user delivery regions. Slot priority orders content within role and runtime boundaries instead of forcing role changes across slots. World-book depth cannot override this identity choice. Only Allow position adaptation maps roles from slots and depth 0/1. The native-instructions switch is independent and can always be turned off.

Assembly errors remain visible until revalidation succeeds; editing or saving does not establish validity. Before applying the current or default strategy, the UI previews it again against the current session or opening draft and refuses application on failure. Checks exclude unsent input; actual requests still revalidate changing resources.

The integrator must update the assembler dependency to a version exposing these APIs and regenerate the package lock and client bundle together. The history-policy engine executes filtering; its rules share the assembly preset, with separate save and apply operations. Validate with `node --test test/resource-layout-*.test.mjs`; full contracts, types and stock/core Host validation are in the assembler's `docs/RESOURCE_LAYOUT_en.md` and Chinese counterpart.

Sorting proceeds through the saved list one strategy at a time. Each pass consumes only unplaced resources; later passes cannot move resources consumed by an earlier pass. Result `sortingStages` records which nodes each pass placed. Resource cards explain declared stability before loading assets. Result cards explicitly distinguish existing native messages, native system/context/pre-step retention, request-only content, and separately retained assembly snapshots. Neither list has up/down buttons.

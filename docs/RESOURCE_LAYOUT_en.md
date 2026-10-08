# Resource assembly layout integration

[中文](RESOURCE_LAYOUT.md)

Resource layout belongs to standalone `dsh-prompt-assembler`. Tavern’s `packages/request-assembler/resource-layout.js` only re-exports `normalizeLayout`, `describeResourceLayout` and `withBlockMove`; it does not copy assembly logic. The existing `AssemblyPanel` wrapper embeds assembler’s policy/current-resource UI, while existing adapters provide character, preset and worldbook entries.

Sources are no longer drag units. Preview separates contiguous output into blocks and positional slots. Partially referenced worldbooks show bound and free groups; free groups move whole, while slot-bound groups require explicit override. Layout source, preserved or adapted roles, and missing-target fallback are independent settings. Saved locators represent stable targets rather than the current activated-entry list; new entries join their groups next request.

Preview and execution share assembler expansion and positioning validation. Standard assembly retains native history, system/user delivery regions and context snapshot reuse; it does not promise arbitrary placement across history, assistant delivery or exact ST depth. Legacy strategies without `layout` retain their behavior until users explicitly adopt, preview, save and apply a policy.

Integration requires updating Tavern’s assembler dependency to a revision containing the resource-layout API and rebuilding its client bundle. The integrator owns `package.json`, lockfile and `dist/client.js`. History filtering remains owned by the separate history-policy module.

Validate with `node --test test/resource-layout-*.test.mjs` and `npm run check`. The full API, bilingual usage and stock/core Host verification procedure are in assembler’s `docs/RESOURCE_LAYOUT.md` and `docs/RESOURCE_LAYOUT_en.md`.

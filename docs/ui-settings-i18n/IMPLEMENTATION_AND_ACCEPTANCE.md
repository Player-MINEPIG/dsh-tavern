# Tavern UI settings and i18n implementation / acceptance

Status: implemented on `feature/ui-settings-i18n` on 2026-08-15. This is the
phase-three implementation and review contract; it is intentionally separate
from the README.

## Outcome

The single draggable `DT` launcher now exposes a fifth surface, UI settings.
It changes only dsh-tavern presentation:

- interface language: Simplified Chinese (`zh-CN`) or English (`en`);
- Tavern UI scale: 75%, 85%, 100%, 115%, 125%, or 150%;
- restore defaults: `zh-CN` and 100%.

Language and scale apply immediately to the launcher, every Tavern resource
panel, its controls, and the Tavern Trace conversation view. The DSH shell,
Conversation, Trajectory, resource documents, compiled profile, durable
history, and per-session bindings are not read or changed by this setting.

## Ownership and flow

`packages/client/src/i18n.js` is the browser-only shared catalog boundary. The
composition root and all five existing Tavern React clients create elements
through its localized factory. Literal UI children plus `title`, `aria-label`,
`placeholder`, and `alt` copy use one active locale. Runtime data crosses an
explicit raw-text boundary: `rawText(value)` preserves an entire value, while
the tagged `uiText` helper translates only literal template fragments and
inserts interpolated values verbatim. Form `value` data is never translated.
Together these rules prevent localization from rewriting imported resource
names, user input, prompt text, entry comments, personas, character data,
lore, diagnostics, or server error text even when they render as children.

The catalog contains semantic keys for the settings surface and the existing
Simplified-Chinese source messages used by the resource clients. A missing
semantic key returns the stable localized `common.unavailable` message; it
never renders the key itself. Locale changes update the in-memory catalog
before React state, then announce `dsh-tavern:ui-settings` so Tavern Trace
rerenders without a page refresh.

The settings flow is:

```text
single DT shell overlay
  -> GET /dsh-tavern/api/ui-settings
  -> UiSettingsStore (global ui-settings.json)
  -> { locale, scale }
  -> shared catalog + Tavern-scoped CSS zoom

settings control
  -> optimistic in-memory apply
  -> PUT /dsh-tavern/api/ui-settings
  -> validated atomic replacement
  -> success retained / failure rolled back
```

`packages/client` remains the only `shell.overlay` owner. No resource client
registers another shell, launcher, Host hook, or HTTP prefix. The loader remains
the only root Host/API dispatcher.

## Persistence and API boundary

`UiSettingsStore` persists one global document under the configured plugin
storage directory:

```json
{
  "schemaVersion": 1,
  "locale": "zh-CN",
  "scale": 1
}
```

The public write shape accepts exactly `locale` and `scale`. Locale is a
two-value whitelist. Scale is finite, between 0.75 and 1.5 inclusive, and must
use 0.05 increments. Unknown properties, out-of-range values, malformed JSON,
and invalid increments are rejected. The request and persisted document are
both capped at 1 KiB. Writes use a mode-0600 temporary file followed by rename;
an oversized, malformed, or legacy-invalid file falls back to defaults without
being parsed past its size boundary.

The root secured API exposes:

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/dsh-tavern/api/ui-settings` | current global settings |
| `PUT` | `/dsh-tavern/api/ui-settings` | replace after full validation |
| `DELETE` | `/dsh-tavern/api/ui-settings` | restore defaults |

All mutations still pass through the existing loopback peer, Host,
same-origin, and JSON content-type wrapper. Settings contain no session id and
the client does not refetch or reset them when the active session changes.

## Scale implementation

Scale is scoped under `.dtv-layer` and `.dttrace-root`; no style or class is
installed on a DSH root node. The floating anchor remains viewport-based.
Clamping and expanded-menu placement account for the scaled ball/menu size,
while the CSS `zoom` offset is normalized back to physical viewport
coordinates. At the default 100% all accepted launcher coordinates are
unchanged except the menu height required for the fifth item. Tavern Trace
compensates its width and height for zoom so its own scroller remains usable.

## Automated verification

`test/ui-settings.test.mjs` covers defaults, atomic persistence, restart,
reset, field/locale/range/increment validation, malformed and oversized files,
and GET/PUT/DELETE behavior. `test/i18n.test.mjs` covers both languages,
interpolation, non-key fallback, accessibility text, complete English creation
labels, raw resource names rendered as children, and raw-data-boundary adoption
by every current Tavern client. The existing shell suite continues to assert
one overlay owner, drag clamping, expansion direction, panel switching,
resource status, and shared refresh behavior; it adds scaled-coordinate and
settings-surface assertions.

Verification command:

```powershell
npm run check
```

Result on 2026-08-15: build succeeded; 144 tests passed, one opt-in local
fixture was skipped, and zero tests failed.

## Security, data-boundary, architecture, and UI self-review

- No API key, token, machine path, private fixture, resource body, or user text
  was added to settings, tests, docs, or logs.
- UI settings are global presentation state, not session policy. No resource
  store, selection, profile compiler, message flow, or Trace record schema was
  modified.
- There is still one `dsh-tavern:profile` Host section, one secured API prefix,
  and one `shell.overlay` registration.
- The catalog helper has no Host, filesystem, API, format, loader, or resource
  dependencies. Resource clients consume it only while rendering. All six
  React clients explicitly mark resource names, user input, entry comments,
  diagnostics, errors, identifiers, timestamps, and other runtime values as
  raw, including values interpolated into otherwise localized UI sentences.
- Default scale preserves the accepted launcher drag and panel geometry. The
  fifth menu row increases only the expanded menu height.

## Manual acceptance

1. Open a blank and then an active DSH session. Verify exactly one `DT` ball is
   visible and still drags, clamps, expands in the available direction, and
   suppresses the post-drag click.
2. Open each resource panel, then UI settings, repeatedly. Verify one click
   switches panels, Escape closes the menu before the panel, and no second
   shell or launcher appears.
3. Change language to English. Verify launcher copy, preset, character,
   world-book, user, confirmation dialogs, accessibility titles, and Tavern
   Trace copy update without reload. Create a preset, prompt, and user and
   verify their default names are fully English. Also create resources named
   `用户`, `世界书`, and `角色卡/预设`; verify those names, entry comments, and
   displayed diagnostics/errors remain byte-for-byte unchanged. Switch back
   to Simplified Chinese.
4. Select 75%, 125%, and 150%. Verify the launcher, menus, panels, controls,
   and Trace scale while the DSH header, navigation, Conversation, and
   Trajectory retain their original size. Drag the ball at each scale and test
   every viewport edge.
5. Refresh the browser and switch between at least two sessions. Verify locale
   and scale remain global, while each session's resource dots/bindings remain
   unchanged.
6. Restore defaults. Refresh again and verify Simplified Chinese / 100%.
7. With DevTools, force the settings PUT to fail. Verify the optimistic change
   rolls back and a localized error is shown without disabling the launcher.

Known manual risk: final pixel behavior of CSS `zoom` depends on the Chromium
version embedded by DSH. Automated geometry covers physical launcher
coordinates, but 75%/150% scrolling and focus rings should still be checked in
the supported real browser before integration acceptance.

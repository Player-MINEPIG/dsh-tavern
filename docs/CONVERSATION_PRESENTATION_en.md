# Math, avatars, message bubbles and restricted interactive cards

[中文](CONVERSATION_PRESENTATION.md) · [Usage](USAGE_en.md) · [API](API_en.md) · [Security](../SECURITY_en.md)

The 2.5.1 contract targets DSH `0.2.0-rc.2`. Public UI services and slots embed Tavern in the Web/desktop document. No separate browser is needed. DSH history remains authoritative; these features store presentation metadata only.

RP displays concrete DSH session/turn errors in place. An active-write-handle error can mean another web or desktop instance holds that session in the shared data directory; finish its work and close that instance before reopening the session. Static message stylesheets and inline styles both use Shadow DOM and an outer paint boundary, preventing fixed-position content from covering the Host UI.

## Math

RP messages, greetings, display edits and static HTML exports share Markdown → KaTeX MathML → DOMPurify. Math is enabled by default without a conversation-settings field or dedicated toggle; DSH source messages, prompts and JSONL remain unchanged. Use `$…$` / `\(…\)` inline and `$$…$$` / `\[…\]` for display math, with multiline delimiters on separate lines. Fractions, roots, integrals, matrices and aligned equations use KaTeX syntax and native browser MathML, without remote fonts or scripts.

Delimiters are recognized in Markdown text. Code, HTML attributes/comments, raw HTML blocks, complete document templates and interactive-card interiors keep their existing semantics. Inline HTML text and Markdown in `<details>` bodies/summaries can contain math. Common prices remain literal, while literal `$x$` requires escaping or code. Markdown emphasis does not consume TeX `*` / `_`; formula styles are scoped to Tavern, and ordinary math does not introduce a shadow root for the whole message. Wide display equations scroll horizontally; streams render closed expressions and unchanged history retains its DOM.

Each formula is limited to 4096 characters, 200 macro expansions and a maximum user-specified size of 10 em. Macros are not shared between formulas; invalid or unsupported TeX falls back to source. KaTeX uses `trust: false` to disable external-resource and HTML extension commands within formulas that require explicit authorization. This setting does not affect ordinary Markdown links, images or existing HTML rendering. Formula output is still sanitized: MathML and text `annotation` are allowed, while `annotation-xml` is forbidden. This is not a full LaTeX document runtime, browser layout still has a resource cost, and a modern MathML-capable browser is required. See [usage](USAGE_en.md#markdown-html-and-template-styles) for escaping and composition rules.

## Avatars

In **DT → User**, upload PNG/JPEG/WebP and save the resource. The browser accepts up to 8 MiB and 8192 pixels per side, center-cropping to 256×256 WebP. The API accepts raster data URIs up to 128 KiB, checking MIME, base64 and image signature; SVG, external URLs and file paths are rejected.

The default user image comes from the user bound to the playthrough root session. The character image uses the bound card's existing PNG endpoint, with a placeholder when absent. Names/descriptions enter prompt assembly; avatars do not.

Message avatars sit beyond the composer's outer edges: character on the left, user on the right, with message bodies and actions in the center. Bubbles shrink to their content and wrap at the center column's maximum width; user bubbles and text align right. Layout follows the Host composer width variable and scopes composer side clearance through public slots to the Session displaying Tavern; leaving the Tavern view restores the Host clearance. Settings previews share the bubble layout and update action sizes from the draft; Apply and save persists the changes.

Click a conversation avatar to upload a replacement for one message or every user/character avatar in this playthrough:

The fixed identity-page adapter accepts only the registered wrapper and HTML digests. Generic fixed IIFE loaders also check lexical selector bindings: local `$` or `jQuery` bindings cannot impersonate the global loader. The original wrapper does not run, and the final opening becomes a message proposal for confirmation outside the card. The adapter's `getCurrentChatId()` is an opaque card-draft namespace; `getCurrentMessageId()` is the bound variable message ID or null. Neither is a general ST/DSH session identity. Drafts are isolated by source, owner and card scope: at most 32 keys, 64 KiB UTF-8 per value and 128 KiB serialized JSON, with a raw-size check before parsing stored data.

Only an opening selection that needs additional world-book entries fetches one registered inert text snapshot through the trusted page. It uses a separate IndexedDB namespace, exact URL/digest, an 8 MiB download bound and a 15-second deadline, and never enters a module graph or executes. Cold restoration rechecks its digest and charges the shared code/data byte budget. Proposal preparation uses the trusted current character, zero-based greeting index and original text digest before macro/regex expansion, independently of the draft ID. The Host statically verifies complete registry entries; a separate button outside the card confirms a CAS commit with a stable operation ID. Identity selection continues only after a real receipt. Empty selections verify their binding and skip writing. Cancellation, switching and disposal revoke pending requests; downloading grants neither world-book nor MVU writes.

```mermaid
flowchart LR
  A[Message override] -->|absent| B[Playthrough role override]
  B -->|absent| C[Bound user avatar or character card]
  C -->|absent| D[Placeholder]
```

- Single-message user overrides use QA node ID; character overrides use QA node ID + variant ID + output segment index. Greetings use greeting index; imports use import position. Edit streaming messages after settlement.
- Replace-all covers existing and future messages for that role and clears its single-message overrides. The other role is unchanged.
- Restore inheritance deletes only that message override. Restore resource defaults clears all overrides for that role in the playthrough.
- Editing a shared user resource changes all playthroughs inheriting its default image. Editing inside a conversation never changes source resources or another playthrough.
- Ordinary new playthroughs start from resource defaults. A branch into a new playthrough copies the current display metadata, then persists independently. Imported-position overrides remain attached to that position after replacing imported content; reset them if needed.

User JSON imports/exports include optional `avatar`. Overrides use the existing timeline's `ext.pmpDshTavern.appearance`, with `schemaVersion:1`, optional `user`/`assistant`, and `messages`. At most 500 message keys and 512K UTF-16 code units of serialized appearance metadata; the existing 1 MiB timeline limit still applies. Existing workspace revision/CAS writes persist changes atomically without modifying DSH logs. Rejected limits/conflicts preserve the previous file.

## Bubble style v1

Open **DT → Conversation settings**. Choose Soft, Paper or Midnight, or edit colors, radius, spacing and font; preview, then apply. Advanced JSON editing and file import/export are available. Import changes the preview only. One custom style is retained with the global settings; exported files can form a personal style library.

[Complete example](examples/bubble-paper.json):

```json
{
  "format": "tavern-bubble", "version": 1, "name": "Paper",
  "radius": 4, "padding": 20, "borderWidth": 1, "font": "serif",
  "user": {"background":"#f4ecd9","text":"#483923","border":"#d5c6a9"},
  "assistant": {"background":"#fffaf0","text":"#40392d","border":"#ded3bd"}
}
```

Name: 1–80 characters. Colors: six-digit `#RRGGBB`. Integer pixels: radius 0–32, padding 8–24, border 0–3. Font: `sans|serif|mono`. Files are limited to 16 KiB. Unknown fields, versions and invalid values fail explicitly. There are no CSS, HTML, JS, URL or privileged-code fields.

`PUT /v1/conversation-settings` accepts optional `bubbleStyle` (the complete document above) and boolean `interactiveCards`, alongside existing `textScale/actionScale`. Omission restores defaults; DELETE resets everything. The existing `conversation-settings.json` persists global presentation settings without changing DSH native styles.

## Three boundaries and implementation choice

1. **Static content:** Markdown passes DOMPurify, with Shadow DOM and paint containment for styles. Automatic external resources are disabled: images require bounded raster data URIs; srcset/poster and similar attributes are removed. CSS blocks/inline styles containing resource functions (url/image/image-set/src), `@import`, or escapes are dropped entirely. Layout, colors, gradients, variables, media queries and animations work. External links require an explicit user click and use `noopener noreferrer`.
2. **Script execution:** closed `html` fences, unlabelled fences beginning with `<body>`/`<html>`, and complete `<html>…</html>`/`<body>…</body>` documents containing controls/scripts are recognized. Static DOM is presented in an iframe with `sandbox="allow-same-origin"` and no `allow-scripts`. CSP denies connections, external images, scripts, child frames and form submissions. Card JS runs in a separate QuickJS WASM interpreter, never in the iframe or parent browser realm. Neither iframe nor Shadow DOM alone is the full security boundary.
3. **Capabilities:** a bounded JSON bridge permits card-local DOM operations, copied display names, and message proposals. There is no generic RPC, Host API, credential, filesystem, network, parent-page or native eval handle. Modules resolve only from resource-scoped downloaded content maps. Only an explicit click on the Tavern button outside the card sends a proposal through the existing user-message API.

The [versioned DSH sandbox](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/sandbox/sandbox/README.md) isolates subprocesses/files, not browser message JavaScript. The [official desktop forwarder](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/src/web-document.ts) strips Origin; the [request token](API_en.md#desktop-request-token) handles this difference without disabling webSecurity.

[Tavern Helper documentation](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/基本用法/渲染器.html) and its [fixed source](https://github.com/N0VI028/JS-Slash-Runner/blob/519599bc68247d8e759cc844a983f8f5252941a8/src/panel/render/Iframe.vue) use srcdoc/blob iframes, injecting public interfaces, external libraries and avatar paths; some helpers bridge to the parent. This implementation borrows the display idea without copying that authority model or claiming full compatibility. A disableable Tavern module reuses existing playthrough/component lifecycles. A separate plugin currently adds cross-plugin lifecycle and permission negotiation without an independent host capability need; reconsider extraction if independently authorized capabilities are added.

```mermaid
flowchart LR
  A[Closed message HTML] --> B[Sanitized script-disabled iframe]
  A --> C[Quota-limited QuickJS]
  C --> D[Bounded JSON allowlist]
  D --> B
  D --> E[Display names]
  D --> F[Proposal outside card]
  F -->|User click| G[Existing Tavern API / DSH history]
```

## Supported interfaces and limitations

Scripts default off; enable them in conversation settings. Start with the [counter example](examples/interactive-counter.html), placing the file in an `html` fence. Remounting, switching playthroughs or changing source creates a fresh runtime. Ordinary parent rerenders preserve state. Streaming content does not execute scripts, while historical cards retain state during other messages' streaming updates. Card variables are memory-only and reset on refresh/remount.

| Interface | Scope |
| --- | --- |
| `document.body`, `getElementById`, `querySelector`, `querySelectorAll` | Card body only; facade objects, never native DOM handles. Sanitization may remove reserved DOM names |
| Element `textContent`, `innerHTML`, `value`, `checked` | innerHTML is sanitized on every write; inserted scripts never activate |
| `createElement`, `appendChild`, `remove` | Allowlisted HTML; script/iframe/style/img/input creation denied. Existing restricted inputs remain interactive |
| `setAttribute/getAttribute`, `classList`, `style.setProperty` | Attribute writes limited to id/class/title/disabled/aria-label/data-action; CSS remains inside iframe/CSP |
| `addEventListener` | click/input/change; document only supports synchronous DOMContentLoaded. No timers, animation callbacks, network or browser libraries |
| `TavernUI.version`, `getContext()` | v1; role and userName/characterName captured at mount, copied JSON without session IDs or credentials |
| `TavernUI.proposeMessage(text)` | Up to 4000 characters; visible proposal, never automatic sending |

External script sources and ES modules use the resource download lifecycle below. Missing dependencies and inline on* handlers disable all scripts in the card. External sources, Helper scripts and JSX use a dedicated Worker running QuickJS with linkedom. Fixed official jQuery 3.6.0, React 18.3.1 and Vue 3.5.13 fixtures cover DOM insertion, click events and state changes. This does not establish full browser compatibility: bounded card-local layout reads are provided below; mutable CSSOM, canvas, parent-page and system APIs remain unavailable. World-book/chat/generation APIs are not supplied by this renderer. Variable writes use the separately authorized MVU bridge described below. Missing runtime APIs fail visibly and dispose the runtime; no silent success. Static HTML export does not execute scripts or export in-memory card state.

The table above describes the small inline facade. Its limits per card are 128K UTF-16 code units of source, 8 MiB interpreter heap, 256 KiB stack; each entry has a 60 ms deadline and 500-interrupt ceiling, 1000 bridge operations and 100 Promise jobs. At most 2048 DOM handles and 256 listeners, with height clamped to 100–800 px. Limits produce visible errors. Browser layout/image decoding, WASM engine defects and expensive CSS denial of service are not completely covered by interpreter quotas; this is not an absolute security guarantee. Existing display RegExp backtracking risks remain.

See [TESTING](TESTING_en.md). Maintainer acceptance of the actual official desktop distribution, real character cards and provider integrations remains necessary before using a real profile.

## Interpreter dependency

`quickjs-emscripten-core` and `@jitl/quickjs-singlefile-browser-release-sync` are pinned to `0.31.0`. The browser variant embeds WASM in the client bundle (embedded in the generated client bundle), with no CDN or external script loader. MIT notices for the wrapper and engine are included in the generated bundle and [source notices](../packages/presentation/THIRD_PARTY_NOTICES.txt). The small inline interpreter initializes lazily; external cards each own a terminable Worker and runtime. The Worker bundles linkedom 0.18.12 and a separate QuickJS context containing fixed @babel/standalone 7.26.10. JSX uses only the React preset with no card-supplied compiler plugins. Acorn 8.15.0 with acorn-jsx 5.3.2 parses dependencies. Additional notices are in [virtual DOM notices](../packages/presentation/VIRTUAL_DOM_NOTICES.txt). Dependency upgrades require the quota and isolation regression tests. [Upstream release](https://github.com/justjake/quickjs-emscripten/releases/tag/v0.31.0).

The style toolbar has Import JSON, Export JSON and Create style at the top. Body font size is part of the previewed style (`fontSize`, optional integer 8–48 px), controlled by a slider or numeric input and saved with Apply. Older v1 files without the field remain accepted and inherit the legacy text scale; the editor converts it to pixels when applying. Unsupported-script notices are localized and deduplicated by cause (external files, modules, other script types or inline event attributes). The master script toggle does not download missing external dependencies.


## Unified settings and external dependencies

The External code tab groups card scripts, external dependencies and related actions. Its single **Allow card scripts to run** switch retains the existing global execution gate, including inline message scripts. Left checkboxes save ordinary per-source choices through conversation settings, initially inheriting imported enabled/disabled values; **Restore source default** removes an override. Expanding an entry reveals complete inert source in a bounded scroll area. Long addresses stay within the panel; ⓘ buttons use the Host tooltip for hover, keyboard focus and touch. Download progress, paused state and errors remain visible. Dependency acquisition and variable-write permission stay separate from these saved choices. See the [settings API](API_en.md) for identity, reset and persistence rules.

**DT → Conversation settings** contains Appearance, Regex replacements and External code tabs. Tab switches preserve style and regex drafts; closing, Escape and menu navigation check unsaved changes. A binding change retains the old regex draft but disables saving; export it or discard it and reload. The separate regex menu is consolidated here.

Discovery accepts character/preset `extensions.tavern_helper` as `{scripts,variables}` or legacy key-value pair arrays, including direct scripts, type/value entries and nested scripts/children. It reads scripts only; MVU owns variable semantics. Greetings, alternate greetings and global/preset/character regex replacements contribute script src, ES import/export/import() and literal `.load()` dependencies, with resource/field provenance. JavaScript dependency discovery uses an AST: multiline import/export and literal dynamic import are recognized; comments and strings do not create dependencies. Computed dynamic imports and syntax failures block the graph with a visible reason.

1. Importing a character or preset lists its directly declared sources and asks once to download their full static dependency graph. Consent covers transitive dependencies. Existing resources have a **Download resource dependencies** action. Inline Helpers need no content approval: source defaults, saved choices and the master switch control execution. Download consent grants neither Host access nor variable writes.
2. The trusted UI downloads static HTTPS text with browser CORS, omitted credentials, rejected redirects and no-referrer. Each file is limited to 8 MiB and 15 seconds. URL deduplication converges automatically within 24 files, 8 levels and 24 MiB. Cycles do not repeat downloads; computed/unresolved references, network failures and limits have explicit states. URL syntax checks do not verify DNS results or guarantee public-only networking.
3. Each resource shows progress and failed items, complete expandable code, download-again and uninstall actions. Downloading again replaces graph contents. Cancel/uninstall abort requests and ignore late results. Acquisition and uninstall advance a resource generation in shared storage transactions; publication atomically checks that generation. Uninstall retains only a code-free generation tombstone, preventing late downloads from restoring old graphs. Cross-tab messages only trigger storage rereads. After asynchronous source preparation, restoration rechecks generation and publication state inside a read transaction before installing code, so a delayed old snapshot cannot restore uninstalled code. Unfinished downloads can be taken over. Different owners cannot inherit the same URL's cache; conflicting bytes for a shared URL in one card are rejected.
4. Graphs and source fingerprints persist in this browser's Host-origin IndexedDB. Reload restores cache without networking. Source changes revoke the old runtime graph and request one updated download. Uninstall deletes the resource cache and invalidates other same-origin tabs; plugin disposal destroys current runtimes but retains browser cache for reinstall. Digests identify bytes, not authors. Cards cannot access or modify the cache.
5. A narrow `$('body').load('https://…')` / jQuery wrapper reads downloaded HTML; relative scripts/modules resolve against the original URL. Parameters, callbacks, selector suffixes and nested wrappers remain unsupported. Workers gain no networking. Disabling, graph replacement, session/variant changes and disposal cancel bindings and destroy runtimes/subscriptions. Missing dependencies retain static content and a reason; “Downloaded” does not claim successful execution.

```mermaid
flowchart LR
  A[Card / preset / regex sources] --> B[Static discovery]
  B --> C[One resource graph consent]
  C --> D[Bounded deduplicated download and browser cache]
  D --> E[Isolated QuickJS and script-disabled iframe]
  F[Update / disable / uninstall] --> G[Cancel bindings and destroy runtime]
```

The runtime memory cache is limited to 64 entries / 64 MiB; each card loads at most 24 URLs, 24M UTF-16 code units and 8 levels. Input HTML remains limited to 128K characters and expanded remote HTML to 1 MiB. Helpers run before the card's HTML scripts, are not independent background tasks, and do not imply arbitrary MVU bundle compatibility.

External Workers allow four concurrent cards, each with a 192 MiB interpreter heap and 1 MiB stack (768 MiB aggregate interpreter cap, excluding browser/Worker overhead). Initialization has a 15-second outer watchdog, individual initial evaluations 2 seconds, later entries 120 ms and a 1.5-second outer response watchdog. Limits include 200 Promise jobs per entry, 10,000 bridge calls, 128 timers, 8,192 DOM nodes, 1 MiB output, 256 outbound messages/second and 128 input events/second. Timers run at 16–60,000 ms; animation callbacks use timers rather than a native layout clock. The display iframe has no script permission and a network-denying CSP. Third-party code receives only virtual DOM objects inside QuickJS, never native Worker/browser handles.

Before changing the iframe or reading layout, the trusted display/measurement receiver independently validates the view types, 1 MiB size and an 8,192-node budget for the sanitized fragment (including the body, text and comments, excluding the receiver's fixed style node). Inert HTML parsing itself remains bounded by input size; this check does not make browser parsing or layout preemptible. The receiver builds a unique node map from the accepted fragment. Only an explicit documentElement request uses the root ID; other targets need a valid matching marker and must remain mounted in this card. Missing, duplicate, removed or sanitized-away targets fail explicitly.

Click/input/change/key/pointer events are copied into virtual events; output is sanitized before display. Focus, selection and scroll are restored across snapshots. This is not a full DOM diff. Missing APIs fail visibly; zero-valued geometry is not fabricated. Runtime evidence outside the card records source hashes, fixed compiler version, JSX input/output hashes, cold-start time and a sampled heap snapshot (not a measurement of peak process memory).

| Extension interface | Supported subset |
| --- | --- |
| `$` / `jQuery` | Card-local selection, ready callbacks, text/html/val/on; independent implementation, no AJAX, plugins or native DOM handles |
| `TavernUI.getVariables(options?)` / `getVariables` | No options or `{type:'message'}`; returns the entire variables object including stat_data/schema/display_data/delta_data and MVU-defined fields, as a read-only JSON copy |
| `getAllVariables()` | The same bound message snapshot, without invented global/chat merging |
| `TavernUI.onVariables(callback)` | Returns an unsubscribe function; committed `{version,scope,revision,variables,status}` snapshots, at most 64 subscriptions; not an upstream mutable before-update event |

Trusted historical playthrough/session/node/variant/endEventId coordinates (plus existing format version) bind variables and are revalidated by the service. Script options cannot select another scope. An empty greeting can request the explicit `{mode:'initial',playthroughId,sessionId,characterId}` scope only for its resolved root session and selected character. The source validates empty durable history and closes this scope permanently after the first turn starts. Leaving, switching character/session or remounting destroys the old binding and grant. Imported and streaming messages without verifiable coordinates receive no binding. Unavailable MVU reads fail explicitly and never fall back to the focused session. MVU owns read-only polling and commit semantics; write operations use a separate Host capability and never inherit model-tool permissions. Sending proposals still requires confirmation outside the card, independently of model tool permissions.

## Separately authorized variable writes

The external-code settings tab lists each mounted card's complete execution bundle (HTML, scripts, modules, source owners and fixed scope). First review its full source and SHA-256; then separately allow variable writes for that exact binding. Both steps default off. The Host recomputes the bundle hash and issues a memory-only, 30-minute grant; changing code, source trust, scope, revoking or unmounting removes permission. No code or grants are saved to card files. The Host stores only the identity/scope and expiry, not uploaded code.

The renderer supports the observed `Mvu.getMvuData(options?)` whole-object read, `Mvu.updateVariablesWith(JSONPatchArray)` and `await Mvu.replaceMvuData(wholeVariables, options?)` forms. Callback overloads are not claimed. Options may only address this bound message; global/chat/character, latest or numeric aliases do not silently redirect a historical bubble. `eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, callback)` provides a no-argument callback after a newer committed revision of this binding. It does not claim upstream event payloads or mutable before-update semantics.

An enabled write grant is necessary but insufficient: the MVU service verifies the current writable resource/head, scope, CAS revision, idempotent operation ID, authority lease and manager policy. Missing integration, historical scopes and denied policy fail explicitly. The renderer generates the operation ID and preserves the revision of the snapshot delivered to the Worker (not a newer lazily created write binding); the VM supplies only operation/value and constrained options. Revocation cancels a writable binding and restores read-only observation. Committed changes use `card_variable_update`, never a fabricated assistant-message event.

The trusted main thread recognizes browser `isTrusted` input, and the native Worker carries a private task ID only during that event's evaluation. The VM never receives this ID. Native timers label interval activity separately; programmatic clicks and initial code are `script`. This prevents a card from choosing its cause. The Host service relies on the existing trusted UI dispatcher for browser-event evidence; it cannot independently or cryptographically prove a human click. Grant creation and revocation additionally require DSH connection admission before reading the request body; the existing local Origin/media-type/desktop-token fence remains. Missing admission closes the write endpoint. An admitted dispatcher is trusted, not a cryptographic proof of human input. Grant IDs and MVU capabilities never enter the interpreter.


Built-in MVU adaptation is separately opt-in and off by default. Only the exact URLs and SHA-256 identities in `mvu-builtins.js` offer this choice after download. The UI and runtime audit disclose that the original bundle is not executed, and preserve its identity and the scoped facade version. Side-effect imports and plain script initialization are supported; named exports, dynamic runtime registration and arbitrary Zod objects are not. A complete schema Helper is omitted from VM execution only when an available authoritative snapshot contains `variables.mvu_schema` with `mvuSchema:1`, `interpreterVersion:1`, and an exact full-source match. The displayed `source-registered` result is a local confirmation derived from that snapshot, not a registration API. Unavailable state, unknown versions or a source mismatch fail visibly.

Before transfer and again in the Worker, expanded initialization is bounded to 128 runs, 24 module entries and 24 MiB UTF-8 total, including repeated code; context/variables are limited to 256 KiB. The startup deadline remains active even if an early timer emits idle. Pause and start/restart buttons let users release older runtimes when four are active. Native pending writes are limited to 32 with monotonic IDs; a trusted input task attributes at most one write. A write has a 30-second deadline. An uncertain outcome or failed result transfer terminates the runtime and shows its operation ID for receipt investigation; it does not retry under a new ID. Local revocation stops writes immediately; failed server revocations remain visible with a retry action even after the card unmounts.


## Card-local layout reads

External Workers use pinned QuickJS Asyncify 0.31.0 so `getBoundingClientRect()`, scrollHeight/scrollWidth, offsetHeight/offsetWidth/offsetTop/offsetLeft, clientHeight/clientWidth and `getComputedStyle()` can synchronously return real layout to the script. Each read submits the current sanitized virtual DOM snapshot and measures only that card's script-disabled iframe. It cannot select the Host page, another card or an external window. Computed style is a snapshot with ordinary properties and `getPropertyValue`, not a live mutable CSSOM. Unrendered nodes cannot fabricate layout. Parent-page, canvas, network, model-tool and system permissions remain unavailable.

Events, timers, variable notifications and Promise jobs enter the interpreter serially. A task allows at most 16 layout requests, each with a one-second deadline and the existing overall execution/startup deadlines. Requests bind a Worker nonce, monotonic ID and current iframe generation. Switching, revocation, unmount or timeout cancels pending measurements and terminates the Worker; late responses cannot resume old tasks. Results are bounded JSON. Geometry is not replaced with zeroes, and Promise semantics are not rewritten as synchronous code. Deadlines are task watchdogs and cannot preempt a synchronous browser layout already running on the main thread; DOM and source-size limits remain necessary.

`quickjs-async-jobs.js` is a pinned internal-API compatibility seam. The public synchronous job wrapper in 0.31.0 is unsuitable for suspended Asyncify jobs; this seam uses an explicitly asynchronous C wrapper and waits before releasing output pointers and value handles. Builds require both core and variant version 0.31.0, and runtime checks require the needed symbols. Unknown versions or missing symbols disable the capability without falling back to the synchronous wrapper. QuickJS upgrades require renewed verification of this internal coupling, nested Promises, errors, cancellation, deadlines and exactly-once releases.

The card viewport provides readonly `innerWidth/innerHeight` and their global aliases from this iframe's actual content dimensions. It does not supply Host DOM, screen or arbitrary Window APIs. The Host observes this card, coalesces changes and dispatches the window `resize` event through the existing serial interpreter queue. Resize has a script cause and does not acquire user-click authority. Switching, pause, revocation and unmount disconnect observers and pending callbacks. html/body class and inline style, including CSS variables, cross as bounded presentation data; other root attributes are outside this interface. Pages containing fixed positioning or viewport units use a `clamp(362px,75dvh,800px)` card panel (including borders, with at least 360px of content height). Inside the iframe, `dvh/vh` and script dimensions refer to this panel. Ordinary flow keeps content-height sizing so fixed content no longer collapses the frame to 100px merely because it cannot expand the body.

In the opening dock, only a single viewport card inside the explicitly marked container uses the embedded layout: the panel is `clamp(392px,75dvh,800px)` high, controls occupy a compact row, and the iframe fills the remaining grid area. Scripts still read the iframe's actual dimensions. A separate taller iframe is no longer placed inside the old `45dvh` scrolling window. Ordinary opening text, multiple-card layouts and the native Host window retain their layout. On narrow screens the source page can scroll within its own scroll area; this interface does not rewrite its minimum heights or responsive rules.

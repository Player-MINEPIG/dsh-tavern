# Security policy

[中文](SECURITY.md)

## Support

The maintained security line is `2.5.x`. DSH compatibility depends on the specific release; consult its README and installation guide. Fixes ship only as new patch versions. Development branches and older releases are not promised separate backports.

Report suspected vulnerabilities privately through the GitHub repository **Security / Report a vulnerability**. Do not first publish a reproducible exploit, user data, or a real local path. Include the affected version, a minimal reproduction, expected impact, and log fragments with secrets removed.

## Threat model

- The plugin targets local DSH Web. HTTP APIs reject non-loopback TCP peers by default and check Host, same-origin writes, and Content-Type. This is not account authentication. A trusted local process can still access the API.
- Tavern resources, character cards, world books, imported records, model replies, and display regex are untrusted input. Resource bodies may become model instructions. Display content is handled only in the browser.
- DSH session and durable history are the message authority. The plugin does not copy or rewrite original history. Timeline stores pointers, branches, and display metadata only.
- RP secure mode is a conservative overlay on DSH permissions. It is not OS-level isolation and cannot stop a user from pasting secrets into the chat.

## Implemented boundaries

- All v1/v2/v3 browser APIs share the same security middleware. Mutating requests require same-origin (or a process token for the official desktop proxy’s absent Origin) and a supported media type.
- Request bodies, resources, structures, Trace, persistent state, and play workspace files have explicit limits.
- LaTeX is converted locally to MathML with KaTeX and then sanitized by DOMPurify. `trust: false` disables external-resource and HTML extension commands within formulas that require explicit authorization (such as `\includegraphics`, `\href` and `\htmlStyle`), `annotation-xml` is forbidden, and macros are not shared between formulas. Formula length, macro expansion and user-specified sizes are bounded; errors fall back to escaped source. These bounds do not eliminate browser-layout or dependency-vulnerability risks. Math loads no remote fonts or scripts and executes no LaTeX file/system commands.
- The play workspace uses safe relative paths, per-segment link/reparse checks, root revalidation, exclusive temp files, atomic replace, and revision/CAS.
- Static rich text passes DOMPurify and uses Shadow DOM/paint containment. Live images are fetched by the trusted parent under visibility, CORS/no-credentials/no-redirect and raster budgets; static exports do not load remote images. URL checks do not verify DNS, and servers can see IP/URL. The iframe and QuickJS retain no arbitrary networking. External links require a click with `noopener noreferrer`. Optional interactive cards render sanitized HTML in a script-disabled iframe, execute JS in quota-limited QuickJS, and expose a card-local JSON DOM bridge, outside-card message confirmation, and a narrow ST input request facade. Input requests require a fresh native click, current Session/editor binding and unchanged draft revision; timers and synthetic events acquire no input authority. See [boundaries and limitations](docs/CONVERSATION_PRESENTATION_en.md).
- Photo selection requires trusted user interaction. The renderer reads only that selected image and reencodes a bounded JPEG; the VM facade receives no original filename/path/bytes or native objects and acquires no arbitrary file, canvas, message-send or storage authority.
- Downloaded, enabled card scripts can read and write their current bound variables without source review or additional write approval. Disabling a script, uninstalling downloaded content or changing the binding ends the corresponding execution. Internal bindings still check the complete source, current Session, schema, CAS and idempotency, and grant no arbitrary network, parent DOM or Host execution access.
- Lifecycle logs use Host `ctx.logger` and a bounded Tavern `operation-logs/` journal (at most 4 MiB; disable persistence with `operationLogs.enabled=false`). Fields have an allowlist and length limits; persistence also excludes paths. Logs omit prompts, user messages, model replies, resource bodies, body lengths, summaries and error message/stack/cause. Queries and paginated exports inherit Tavern API security; there is no browser log upload. Session and operation identifiers may remain sensitive; review before sharing.
- The public repository and release package must not contain real developer-machine paths, usernames, temporary download paths, private fixtures, imported resources, or secrets. Documentation paths may use only explicit generic placeholders.

## Trace official-history references

Current Trace combines v1 audit and v3 assembly metadata in the atomically written, mode-0600 schema 4 `tavern-trace-records.json`. It stores official Session references, hashes, counts, resource/model/tool summaries, and provenance relationships. It stores no section, context, system-message, or `source.text` body copies. Detail reads cold-inspect official DSH history and return section/context bodies only after Session identity, log cut, event, message, hash, and range verification. Source text always remains `textStatus: "not-stored"`. Unrecoverable content is explicitly unavailable; current resources and another full-text copy are never used as fallback. Defaults are 256 records / 2 MiB each / 16 MiB total.

Old `tavern-traces.json` metadata and old `tavern-assemblies.json` schema 3 body snapshots remain read-only; the latter may still contain sensitive prompts captured before upgrade. Although the schema 4 record file has no prompt bodies, its reference metadata can still be sensitive, and the local detail API can return verified prompt bodies from DSH history. Protect the data directory and API as DSH Session data. Details: [contract](docs/PROMPT_API_V3_en.md).

## Known risks and operator requirements

- Do not expose DSH Web or this plugin API to a LAN or the public internet. Reverse-proxy deployments must supply their own TLS, authentication, and trusted Host configuration.
- Presets, cards, world books, imported records, and user messages can contain prompt injection. A high-privilege Agent may call already-approved terminal, file, network, browser, or third-party plugin capabilities when induced. Use trusted content only, keep secrets out of the conversation, and retain DSH tool approval, sandboxing, and least privilege.
- RP secure mode and its inheritance by child agents is an overlay on DSH permissions, not a VM, container, or OS sandbox. It does not constrain other local processes and does not promise to cover capabilities added by other plugins.
- ST/user display regex uses JavaScript `RegExp` with no portable synchronous timeout. A malicious or catastrophic-backtracking rule can freeze the current page. The importer is responsible for reviewing rules.
- Interpreter quotas do not fully cover browser layout/image decoding, costly CSS, or engine vulnerabilities; rendering untrusted content still carries availability risks.
- DOMPurify prevents browser HTML injection. It does not make prompts safe and does not limit Agent tool permissions.
- Loopback/Origin API protection does not stop a local malicious process. Lifecycle log location, retention, and rotation are decided by DSH/Cordis and are not a tamper-evident audit log.
- swipe, branch, and playthroughs create real DSH sessions and can increase disk use significantly. Keep the play workspace on a non-system volume with enough space.

## Release checks

Maintainers should run at least:

```text
npm audit --omit=dev
npm run verify:2.0
```

Also confirm the actual pack list, public branch history, and generated bundle contain no real local paths or secrets, and verify native/play switching, multi-tab convergence, and uninstall fallback on the target DSH version. Release must not push automatically. Maintainers review commits, then merge, tag, and push.

# Security policy

[中文](SECURITY.md)

## Support

The maintained security line is `2.0.x`. Fixes ship only as new patch versions. Development branches and older releases are not promised separate backports.

Report suspected vulnerabilities privately through the GitHub repository **Security / Report a vulnerability**. Do not first publish a reproducible exploit, user data, or a real local path. Include the affected version, a minimal reproduction, expected impact, and log fragments with secrets removed.

## Threat model

- The plugin targets local DSH Web. HTTP APIs reject non-loopback TCP peers by default and check Host, same-origin writes, and Content-Type. This is not account authentication. A trusted local process can still access the API.
- Tavern resources, character cards, world books, imported records, model replies, and display regex are untrusted input. Resource bodies may become model instructions. Display content is handled only in the browser.
- DSH session and durable history are the message authority. The plugin does not copy or rewrite original history. Timeline stores pointers, branches, and display metadata only.
- RP secure mode is a conservative overlay on DSH permissions. It is not OS-level isolation and cannot stop a user from pasting secrets into the chat.

## Implemented boundaries

- All v1/v2 browser APIs share the same security middleware. Mutating requests require same-origin and a supported media type.
- Request bodies, resources, structures, Trace, persistent state, and play workspace files have explicit limits.
- The play workspace uses safe relative paths, per-segment link/reparse checks, root revalidation, exclusive temp files, atomic replace, and revision/CAS.
- Rich text is parsed as Markdown and then must pass DOMPurify. script, iframe, object, embed, form controls, style/meta/link/base, and `srcdoc` are forbidden. External links get `noopener noreferrer`.
- Lifecycle logs use Host `ctx.logger` only, with a field allowlist and length limits. They do not record prompts, user messages, model replies, resource bodies, body lengths, or summaries.
- The public repository and release package must not contain real developer-machine paths, usernames, temporary download paths, private fixtures, imported resources, or secrets. Documentation paths may use only explicit generic placeholders.

## Known risks and operator requirements

- Do not expose DSH Web or this plugin API to a LAN or the public internet. Reverse-proxy deployments must supply their own TLS, authentication, and trusted Host configuration.
- Presets, cards, world books, imported records, and user messages can contain prompt injection. A high-privilege Agent may call already-approved terminal, file, network, browser, or third-party plugin capabilities when induced. Use trusted content only, keep secrets out of the conversation, and retain DSH tool approval, sandboxing, and least privilege.
- RP secure mode and its inheritance by child agents is an overlay on DSH permissions, not a VM, container, or OS sandbox. It does not constrain other local processes and does not promise to cover capabilities added by other plugins.
- ST/user display regex uses JavaScript `RegExp` with no portable synchronous timeout. A malicious or catastrophic-backtracking rule can freeze the current page. The importer is responsible for reviewing rules.
- To stay compatible with ST rich text, sanitized images and inline styles can still trigger remote resource requests and expose the visitor IP to the resource server. Do not enable untrusted display templates.
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

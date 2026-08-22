# RP secure mode

[中文](RP_SECURE_MODE.md)

RP is a session overlay, not a DSH agent preset. When it is on, this plugin intercepts high-risk tool calls before dispatch, pins a read-only file sandbox, and cancels the current turn. Changing the chat-bar permission chip cannot lift these limits. Turn it off with the RP switch on the character card, or with `/rp off`. Whether binding a character card enters RP automatically is controlled by **Follow character into RP** in UI settings; it is on by default.

Child agents **may be spawned**. The child inherits the same limits and freezes the parent session's Tavern resource selection at that moment (the same projection as **New chat with current settings**). Whether the delegated task is narrowed is decided by the parent agent's spawn prompt, not by `rp:policy`. The parent can still summarize candidates or per-character output.

`rp:policy` is an optional short note (editable in UI settings, stored in `rp-policy.json`). By default it only tells the model that high-risk operations are locked. Identity and style belong in the preset or character card. If the field is empty, no extra text is attached; the lock still applies.

Secrets the user pastes into chat are out of scope.

## What is blocked

| Capability | Tool / behavior | Notes |
|---|---|---|
| Write files | `write`, `edit`, `str_replace_editor` | Reject immediately and cancel that agent's current turn |
| Terminal | `bash`, `pwsh` | DSH read-only sandbox does not cover the network; the whole class is blocked so curl/upload cannot slip through |
| Arbitrary code entry | `run_code` | Program entry used in Code Mode |
| Fetch URL | `web_fetch` | Usually off in the default recipe; blocked if it appears |
| Privilege escalation | `sandbox_permissions` on any tool | No Allow/Reject prompt; reject directly |
| Read outside workspace | `read`, `read_image`, `glob` with `path` | Only paths inside the current session workspace (`cwd`) |
| Secret files | `read` / `read_image` targeting `.env`, `.env.*`, `.credentials.yaml`, `credentials.json`, `secrets.json`, `.netrc`, common private-key/certificate names | Not read even if the file is inside the workspace |
| Content search | `grep` | Would search `.env` bodies in the workspace, so the whole class is blocked; use `glob` + `read` for non-secret files |
| Child agents | `subagent` / `subagent_fork` / `send_message` are not blocked | The child inherits the RP lock; the notice is recorded on the **parent session**, and only that child is cancelled |
| Read-only sandbox | `sandbox/mode = read-only` | Chat-bar chip changes are pinned back immediately |

On intercept, an information dialog appears (not an approval): it says a write or other high-risk operation is in progress and to retry after turning RP off.

## What is not blocked

| Capability | Why |
|---|---|
| `web_search` | Workspace reads are already limited, so the model cannot see secret files; sending a search query is outside this mode's threat model |
| Spawn child agents, `workflow`, `ralph`, `list_agents`, `interrupt_agent`, `report` | The child carries the parent's Tavern selection and RP lock; task narrowing is left to the spawn prompt |
| `skill` | Injected content can be inspected in the official DSH trajectory |
| `ask_user_question`, `todo_write`, goal tools, `exit_plan_mode` | Session state and questions to the user; they do not change files/network |
| `job_output` / `job_list` / `job_kill` | Background jobs are DSH Tasks (work the agent started with `run_in_background`, often wrapping an already-running shell/child agent), not a separate process API. New shell jobs cannot be started |
| Changing the DSH agent preset | Left to advanced users |
| Content the user sends in chat | Material the user chose to provide |
| MCP and other tools not named in the default recipe | Unnamed tools are not blocked by default |
| This plugin's HTTP API, frontend reads of session logs / resource library | The lock hangs only on `tools.guard` (model calls to `read` / `write` / terminal, and so on). Browser or loader fixed-code paths are not agent tool calls and are not blocked by default |

## After RP is turned off

The lock is released and the file sandbox tries to restore the mode from before RP. Child sessions that still carry their own RP state stay locked until that child session ends.

# RP 安全模式

RP 是会话叠加，不是 DSH agent preset。开启后，本插件在工具 dispatch 前拦截高风险调用、钉死只读文件沙箱，并中断当前轮；聊天栏改权限不能放开这些限制。关掉方式：角色卡上的 RP 开关，或 `/rp off`。

子 agent **可以派**。孩子沿用同一套限制，并固化父会话当时的 Tavern 资源选择（与「用当前配置新开对话」相同）。委派任务是否收窄由主 agent 的 spawn 提示决定，不写在 RP 政策里。父 agent 仍可汇总各候选或各角色的输出。

用户在对话里主动贴出的秘密，插件不管。

## 拦了什么

| 能力 | 工具 / 行为 | 说明 |
|---|---|---|
| 写文件 | `write`、`edit`、`str_replace_editor` | 直接拒绝并中断该 agent 当前轮 |
| 终端 | `bash`、`pwsh` | DSH 只读沙箱不管网络；整类拦住才能挡住 curl/上传 |
| 任意代码入口 | `run_code` | Code Mode 下的程序入口 |
| 抓取 URL | `web_fetch` | 默认配方里通常是关的；一旦出现同样拦住 |
| 升权 | 任意工具的 `sandbox_permissions` | 不弹出 Allow/Reject，直接拒绝 |
| 工作区外读取 | `read`、`read_image`、带 `path` 的 `glob` | 只能读当前会话工作区（`cwd`）内的路径 |
| 机密文件 | `read` / `read_image` 指向 `.env`、`.env.*`、`.credentials.yaml`、`credentials.json`、`secrets.json`、`.netrc`、常见私钥/证书名 | 即使文件在工作区里也不读 |
| 内容搜索 | `grep` | 会把工作区里的 `.env` 正文搜出来，因此整类拦住；用 `glob` + `read` 读非机密文件 |
| 子 agent | 不拦 `subagent` / `subagent_fork` / `send_message` | 孩子继承 RP 锁；违规时弹窗记在**父会话**，只中断那个孩子 |
| 只读沙箱 | `sandbox/mode = read-only` | 聊天栏改芯片会被立刻钉回去 |

触发拦截时弹出告知窗（不是审批）：说明正在进行写入等高风险操作，关掉 RP 后再试。

## 没拦什么

| 能力 | 没拦原因 |
|---|---|
| `web_search` | 工作区读取已被限制，模型看不到机密文件，搜索 query 外传不在本模式的威胁模型里 |
| 派子 agent、`workflow`、`ralph`、`list_agents`、`interrupt_agent`、`report` | 孩子带上父级当时的 Tavern 选择和 RP 锁；任务收窄交给 spawn 提示 |
| `skill` | 注入内容可在 DSH 官方轨迹里查看 |
| `ask_user_question`、`todo_write`、goal 工具、`exit_plan_mode` | 会话状态与对人提问，不改文件/网络 |
| `job_output` / `job_list` / `job_kill` | 后台任务是 DSH 的 Task（agent 用 `run_in_background` 拉起的工作，常常包着一条已在跑的 shell/子 agent），不是独立的「进程 API」。新的 shell 任务已经起不来 |
| 换 DSH agent preset | 留给高级用户 |
| 用户在聊天里自己发送的内容 | 用户自愿给出的材料，插件不管 |
| MCP 等未出现在默认配方中的工具 | 未点名则默认不拦 |

## 关 RP 之后

锁定解除，文件沙箱尝试恢复进入 RP 前的模式。子会话若仍带着自己的 RP 状态，会保持锁定直到该子会话结束。

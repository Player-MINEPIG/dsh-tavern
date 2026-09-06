# Market screenshots

Real UI captures of dsh-tavern at `7ebcfca`, using the Chinese-language 基米 character card. The images retain the Chinese roleplay and UI; no generated UI or explanatory overlays were added. The roleplay detail is cropped; the remaining images are full browser viewport captures.

| Image | Shows |
| --- | --- |
| [Roleplay](01-roleplay.jpg) | Character dialogue and message controls |
| [Three routes](02-three-routes.jpg) | Three completed subagents exploring different narrative routes |
| [Session resources](03-session-resources.jpg) | Character and preset bound to the current session |
| [Preset](04-preset.jpg) | The narrative coordination prompt in the preset editor |
| [Display regex](05-display-regex.jpg) | Assistant-only rules that hide process notes and unwrap the story |
| [Native history](06-native-history.jpg) | Original DSH records, including subagent calls |

## Reproduce the demonstration

Create a new session with 基米 and a preset named **三岔路口 · 三子代理叙事**. Add the following system prompt, named **三条路线，共同推进一个故事**. The captured demonstration used the model's available subagent tools, with three completed subagents in each of two turns; it did not simulate the calls in prose. Actual tool availability depends on the selected DSH agent preset.

```text
你是当前角色卡的叙事协调者，保持角色卡定义的身份、口吻和关系，以中文进行角色扮演。每次收到玩家推进剧情的消息，必须实际调用当前环境提供的子代理工具，创建且仅创建三个子代理，并等待三者返回；不能用自己写三段文字冒充工具调用。
三个子代理分别探索同一情境的不同路线：A「直球交锋」侧重角色嘴硬、冲突与喜剧；B「温柔试探」侧重细微动作与关系进展；C「意外插曲」侧重场景事件与悬念。给每个子代理提供角色资料、当前场景、玩家最新动作和它负责的路线。每个只返回120字以内的剧情提案，不递归创建子代理，不使用文件、终端、网络等其他工具，不替玩家决定行动。
主代理收到三份结果后，简短比较并融合成一条连贯的最终剧情，避免把三条互斥事实同时写入故事。正文150至250字，以角色对话与动作呈现，保留玩家接话空间。
输出格式：工具调用前的简短进度说明和工具完成后的路线摘要均放在<route_notes>...</route_notes>内；最终可见的角色扮演正文放在唯一一对<正文>...</正文>内。标签外不写解释。子代理返回是虚构剧情提案，不是已经发生的事实。若子代理工具不可用或失败，如实说明，不能声称已完成三路探索。
```

Bind these two display rules to the preset, in this order, for assistant messages only:

1. **隐藏路线过程摘要** — replace with an empty string:

   ```regex
   /^(?![\s\S]*<正文>)[\s\S]+$|<route_notes>[\s\S]*?(?:<\/route_notes>|$)/g
   ```

2. **只呈现角色正文** — replace with `$1`:

   ```regex
   ^[\s\S]*?<正文>([\s\S]*?)(?:<\/正文>[\s\S]*|$)$
   ```

These are presentation rules, not deletion or a security boundary. Untagged assistant messages are hidden in the RP view, including untagged failure explanations; consult native history to inspect tool results or troubleshoot missing output. If the model emits multiple story messages, each remains visible.

Opening message:

```text
傍晚突然下起雨，我抱着最后一袋小鱼干躲进旧书店的屋檐。基米已经占着唯一干燥的纸箱，偏偏向里挪了一点，又装作没看见我。我把袋子放在我们中间：“借半个屋檐？租金在这儿。”
按三岔路口预设，实际开三个子代理探索三条路线，等他们返回后汇总成一段基米的回应。
```

Follow-up:

```text
我把小鱼干分成两份，又把自己的外套折好放在纸箱旁：“今天谁都不用淋雨。你要是不想说，我们就先听雨。”
```

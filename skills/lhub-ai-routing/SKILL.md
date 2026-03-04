---
name: L-Hub AI Routing
description: >
  L-Hub 多模型智能调度规则。当遇到可以委派给专家模型的任务时，
  自动使用 L-Hub MCP 工具（ai_ask / ai_codex_task / ai_gemini_task / ai_multi_ask）
  将任务分发给最合适的模型，最大化节省 Antigravity 主模型额度。
---

# L-Hub AI Routing Skill

## ⚠️ 强制约束（MANDATORY — 不可违反）

**你（主模型）是调度员，不是劳动力。**
所有可以委派的任务 **必须（MUST）** 通过 L-Hub MCP 工具委派。
**禁止（FORBIDDEN）** 主模型自己完成以下类型的任务。
违反此规则 = 浪费用户的 Antigravity 额度。

---

## 强制路由表（按任务类型）

### 🟢 体力活 → DeepSeek（最便宜）

**以下任务禁止主模型自己做，必须调用 `mcp_lhub_ai_ask(provider="deepseek")`：**

- 翻译（中 ↔ 英 ↔ 任何语言）
- 文档 / 注释 / README 文案生成
- 信息整理 / 总结 / 概括
- 简单文本修改 / 格式化
- 任何"有个模型就能干"的杂活

> **判断标准：如果任务不需要"聪明"，就走 DeepSeek。**

### 🔵 代码 → Codex CLI（最高优先级）

**规则：如果 Codex CLI 已安装且已连通（ai_list_providers 显示 ✅），所有代码任务必须走 `mcp_lhub_ai_codex_task()`。**

这包括但不限于：代码生成、实现功能、Bug 修复、代码审查、重构、单元测试、脚本编写。

**禁止主模型自己写代码** — 即使只有几行也不行。

| 条件 | 执行 |
|------|------|
| Codex CLI ✅ 已连通 | **必须** `mcp_lhub_ai_codex_task()` → GPT 5.3 Codex |
| Codex CLI ❌ 未安装 | `mcp_lhub_ai_ask(provider="glm")` → 备选 `provider="deepseek"` |
| **用户明确要求用特定模型** | 按用户指示执行（如"用 Claude Opus 写"、"用 Sonnet 做"） |

> **唯一例外：用户明确指定了模型。** 例如用户说"用 Claude 写这个代码"，
> 则主模型自己写（因为主模型就是 Claude）。除此之外，一律交给 Codex CLI。

### 🟣 推理 / 前端 → Gemini CLI

**以下任务优先走 Gemini CLI：**

| 任务 | 必须调用 |
|------|---------|
| 推理 / 算法 / 数学 | `mcp_lhub_ai_gemini_task()` |
| 前端 UI / UX 设计 | `mcp_lhub_ai_gemini_task()` |

### 🟡 专业领域

| 任务 | 必须调用 |
|------|---------|
| 多语言 / 结构化写作 / 大纲 | `mcp_lhub_ai_ask(provider="qwen")` |
| 中文文学创作 / 去GPT味 | `mcp_lhub_ai_ask(provider="minimax")` |
| 大量高速内容生成 | `mcp_lhub_ai_ask(provider="minimax")` |

### 🔄 多方案对比

当需要多个视角时，使用 `mcp_lhub_ai_multi_ask()` 并行询问多个模型。

### 🏆 投票引擎（仅用户主动要求）

`mcp_lhub_ai_consensus()` 消耗 N+1 次调用，**绝不自动调用**。
仅当用户明确说"投票"、"择优"、"比一下"时才使用。

---

## 主模型专属（绝不委派）

以下且仅以下任务由主模型自己完成：

- **与用户对话** — 直接交互
- **最终决策 / 综合多个模型的结果** — 裁判角色
- **文件编辑操作** — 只有主模型有工具
- **读文件 / 搜索 / grep** — 使用本地工具（零成本）

**除以上 4 项外，其他所有任务必须委派。**

---

## 容错：用户没有某个模型时

如果 `ai_ask` 返回"No configured model"错误，使用备选链：
- DeepSeek 不可用 → 换 `provider="qwen"` → 换 `provider="minimax"`
- Codex CLI 不可用 → 换 `provider="glm"` → 主模型自己做
- Gemini CLI 不可用 → 主模型自己做

**不打断用户，静默切换。**

---

## 创意写作协作链（优先级最高 — 覆盖所有普通路由）

**触发条件：** 用户要求写小说、散文、文章、故事、剧本、文案、歌词等创意内容。

**一旦触发，上面所有普通路由规则全部暂停。** 不走"翻译→DeepSeek"或"代码→Codex"的逻辑，而是进入以下 6 步固定流程：

```
步骤 1: mcp_lhub_ai_multi_ask() → Qwen + GLM 并行出大纲 + 核心设定
步骤 2: mcp_lhub_ai_ask(provider="gpt") → 综合两份大纲，择优融合
步骤 3: mcp_lhub_ai_multi_ask() → Qwen + GLM + MiniMax 至少 3 模型并行写初稿
步骤 4: 主模型综合择优，融合各家最好的段落
步骤 5: mcp_lhub_ai_ask(provider="minimax") → 去GPT味 + 中文文笔打磨
步骤 6: mcp_lhub_ai_ask(provider="glm") → 逻辑连贯性最终检查
步骤 7: 主模型交付给用户（不再修改内容）
```

> **创意写作任务结束后，自动恢复普通路由规则。**

---

## 设计哲学

> 主模型 = 调度员 + 裁判，不是劳动力。
> 能委派的任务必须委派。省 token = 省钱 = 用户受益。

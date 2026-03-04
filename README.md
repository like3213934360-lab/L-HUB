<div align="center">

# L-Hub

**MCP AI Bridge — 智能多模型路由**  
*Smart Multi-Model Routing for Antigravity*

让 Antigravity 自动把子任务委派给最合适的专家模型，省 token、降成本。  
*Delegate subtasks to the best expert models — save tokens, cut costs.*



**DreamLike**

</div>

---

## ✨ 核心特性（Features）

- **🤖 内置 AI 调度 Skill（Built-in AI Routing）**  
  安装后自动注入调度 Skill。按四层规则将体力活、代码审查委派给低成本模型，创意写作走多模型协作。让主模型专注高价值工作，最大化节省额度。

- **🏆 多模型投票引擎（Multi-Model Voting Engine）**  
  使用 `ai_consensus` — 对话中告诉主模型"投票择优"即可启动，多模型并行回答、裁判打分并返回最佳答案。按需手动触发，不自动消耗额度。

- **🔀 自动路由寻优（Smart Auto-Routing）**  
  无缝桥接 13 大类型任务，按任务属性自动分发给性价比最对应的专家模型。

- **🌐 8 大厂商全覆盖（8 Providers）**  
  原生支持 DeepSeek、GLM、Qwen、MiniMax、Kimi、OpenAI、Claude、Gemini 以及主流聚合平台中转，支持自定义 Base URL。

- **🔌 内置 CLI Agent（Built-in CLI Agents）**  
  支持接入 Codex CLI (ChatGPT OAuth) 和 Gemini CLI (Google OAuth)，可直接享受您的官方订阅账户额度。

- **🧪 标准测试 & 诊断（Test & Diagnostics）**  
  Dashboard 内置一键测试 Prompt，轻松验证全部 8 项功能（7 个 MCP 工具 + Skill）。

---

## 🚀 快速开始（Quick Start）

> ⚠️ **L-Hub 仅支持 Antigravity IDE**
> *L-Hub only supports Antigravity IDE*

**1. 安装（Install）**  
在 Antigravity 扩展商城搜索 **L-Hub** 并安装。

**2. 重启（Reload）**  
安装完成后，L-Hub 会自动注册 MCP 配置并注入 AI 调度 Skill。

**3. 配置 API Key（Setup）**  
使用快捷键 `Cmd/Ctrl + Shift + P` → 输入/选择 `L-Hub: Open Dashboard` → 添加需要的模型并填入密钥。

**4.（可选）配置 CLI（Optional CLI Config）**  
支持官方 OAuth 登录以享受无限制额度：
- **Codex**: `npm install -g @openai/codex && codex login`
- **Gemini**: `npm install -g @google/gemini-cli && gemini`

**5. 测试功能（Test）**  
打开 Dashboard，点击 🧪 测试按钮，一键复制测试 Prompt 并粘贴到聊天窗口中，等待自动生成测试报告。

**6. 开始使用（Go）**  
现在，像平时一样发起对话即可。L-Hub 会在后台根据任务情况，自动处理子任务的路由分发。

> **验证状态（Verify）：**
> 在 Antigravity 的工具面板中看到以下 MCP 工具，即表示服务已启动：
> 🟢 `lhub / ai_ask`
> 🟢 `lhub / ai_consensus`
> 🟢 `lhub / ai_codex_task`
> 🟢 `lhub / ai_gemini_task`

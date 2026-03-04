# L-Hub 安装验证测试

> 将下面的 **测试 Prompt** 粘贴到 Antigravity 聊天框中，主模型会自动逐项测试所有功能并给出报告。

---

## 测试 Prompt（直接复制粘贴）

```
请执行 L-Hub 完整功能验证测试，逐项测试以下所有 MCP 工具，并在最后给出标准测试报告。

=== 测试项 ===

1. 【ai_list_providers】调用 mcp_lhub_ai_list_providers()，列出所有已配置的模型和任务类型。
   通过标准：返回至少 1 个已启用模型

2. 【ai_ask】调用 mcp_lhub_ai_ask(message="请回复：L-Hub 连通性测试成功")，不指定 provider，让系统自动路由。
   通过标准：收到正常文本回复

3. 【ai_ask 指定 provider】如果步骤 1 中有多个 provider，选择第一个，调用 mcp_lhub_ai_ask(message="请回复你的模型名称", provider="<第一个provider>")
   通过标准：回复中包含模型名称

4. 【ai_multi_ask】调用 mcp_lhub_ai_multi_ask(message="1+1等于几？请只回答数字")
   通过标准：至少 2 个模型返回结果

5. 【ai_consensus】调用 mcp_lhub_ai_consensus(message="JavaScript 中 const 和 let 的区别是什么？请用一句话回答", criteria="accuracy")
   通过标准：返回评分和最佳答案

6. 【ai_codex_task】调用 mcp_lhub_ai_codex_task(task="echo L-Hub Codex test OK")
   通过标准：返回执行结果（如未安装 Codex CLI 则标记为 SKIP）

7. 【ai_gemini_task】调用 mcp_lhub_ai_gemini_task(prompt="请回复：Gemini CLI 连通测试成功")
   通过标准：返回正常回复（如未安装 Gemini CLI 则标记为 SKIP）

=== 报告格式 ===

测试完成后，请按以下格式输出报告：

## L-Hub 测试报告
- 测试时间：<当前时间>
- L-Hub 版本：<从 ai_list_providers 获取>
- 已配置模型数：<数量>

| # | 测试项 | 状态 | 耗时 | 备注 |
|---|--------|------|------|------|
| 1 | ai_list_providers | ✅/❌ | - | |
| 2 | ai_ask (自动路由) | ✅/❌ | Xms | |
| 3 | ai_ask (指定provider) | ✅/❌ | Xms | |
| 4 | ai_multi_ask | ✅/❌ | Xms | X个模型 |
| 5 | ai_consensus | ✅/❌ | Xms | |
| 6 | ai_codex_task | ✅/❌/SKIP | Xms | |
| 7 | ai_gemini_task | ✅/❌/SKIP | Xms | |

总结：X/7 通过（X 项跳过）

如发现问题，请将此报告粘贴到：
https://github.com/readysteadyscience/L-Hub/issues/new
```

---

## 快速连通性测试（精简版）

如果只想快速验证 L-Hub 是否正常工作，粘贴这段：

```
调用 mcp_lhub_ai_list_providers() 列出所有可用模型，然后用 mcp_lhub_ai_ask 向第一个可用模型发送 "L-Hub 测试成功"。
```

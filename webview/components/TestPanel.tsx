import React, { useState } from 'react';
import { colors, radius, s } from '../theme';
import { Lang } from './Dashboard';
import { vscode } from '../vscode-api';

const TestPanel: React.FC<{ lang: Lang }> = ({ lang }) => {
    const isEN = lang === 'en';
    const [copied, setCopied] = useState(false);

    const title = isEN ? 'Standard Test & Diagnostics' : '标准测试 & 诊断';
    const desc = isEN
        ? 'After installing L-Hub, paste the test prompt below into the Antigravity chat to verify all MCP tools work correctly.'
        : '安装 L-Hub 后，将以下测试 Prompt 粘贴到 Antigravity 聊天框中，主模型会自动测试所有功能并生成报告。';

    const testPrompt = isEN
        ? `Run a complete L-Hub feature test. For each item below, test and report the result:

1. mcp_lhub_ai_list_providers() — list all configured models
2. mcp_lhub_ai_ask(message="Reply: L-Hub connectivity test OK") — auto-route
3. mcp_lhub_ai_ask(message="What is your model name?", provider="<first available>") — specific provider
4. mcp_lhub_ai_multi_ask(message="What is 1+1? Reply with just the number") — multi-model
5. mcp_lhub_ai_consensus(message="Difference between const and let in JS? One sentence.", criteria="accuracy") — voting engine
6. mcp_lhub_ai_codex_task(task="echo L-Hub Codex test OK") — Codex CLI (SKIP if not installed)
7. mcp_lhub_ai_gemini_task(prompt="Reply: Gemini CLI test OK") — Gemini CLI (SKIP if not installed)
8. Skill Verification — Check if file ~/.gemini/antigravity/skills/lhub-ai-routing/SKILL.md exists. Read it and confirm you can see the L-Hub AI Routing rules. PASS if you can see the routing tables.

After testing, output a report table:
| # | Test | Status | Time | Notes |
Then summarize: X/8 passed (X skipped).
If any failed, suggest pasting the report to: https://github.com/readysteadyscience/L-Hub/issues/new`
        : `请执行 L-Hub 完整功能验证测试，逐项测试以下所有功能，最后给出标准报告。

1. 调用 mcp_lhub_ai_list_providers()，列出所有已配置模型。通过标准：返回至少 1 个已启用模型
2. 调用 mcp_lhub_ai_ask(message="请回复：L-Hub 连通性测试成功")，不指定 provider。通过标准：收到正常回复
3. 如步骤1有多个 provider，选第一个调用 mcp_lhub_ai_ask(message="请回复你的模型名称", provider="<第一个>")
4. 调用 mcp_lhub_ai_multi_ask(message="1+1等于几？请只回答数字")。通过标准：至少2个模型返回
5. 调用 mcp_lhub_ai_consensus(message="JS中const和let的区别？一句话回答", criteria="accuracy")。通过标准：返回评分+最佳答案
6. 调用 mcp_lhub_ai_codex_task(task="echo L-Hub Codex test OK")。未安装 Codex CLI 标记 SKIP
7. 调用 mcp_lhub_ai_gemini_task(prompt="请回复：Gemini CLI 连通测试成功")。未安装标记 SKIP
8. Skill 验证 — 检查 ~/.gemini/antigravity/skills/lhub-ai-routing/SKILL.md 文件是否存在，读取内容确认能看到 L-Hub AI 调度规则表。通过标准：文件存在且包含路由规则

测试完成后按以下格式输出报告：
| # | 测试项 | 状态 | 耗时 | 备注 |
总结：X/8 通过（X项跳过）
如发现问题，请将报告粘贴到：https://github.com/readysteadyscience/L-Hub/issues/new`;

    const quickTest = isEN
        ? 'Call mcp_lhub_ai_list_providers() to list all available models, then send "L-Hub test OK" to the first available model via mcp_lhub_ai_ask.'
        : '调用 mcp_lhub_ai_list_providers() 列出所有可用模型，然后用 mcp_lhub_ai_ask 向第一个可用模型发送 "L-Hub 测试成功"。';

    const handleCopy = (text: string) => {
        vscode.postMessage({ command: 'copyToClipboard', text });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDiagnostic = () => {
        vscode.postMessage({ command: 'generateDiagnostics' });
    };

    const stepsTitle = isEN ? 'How to Test' : '测试步骤';
    const steps = isEN
        ? ['Install L-Hub and reload Antigravity', 'Open a chat window', 'Copy the test prompt below', 'Paste into chat and send', 'The AI will auto-test all 8 items (7 MCP tools + Skill) and generate a report']
        : ['安装 L-Hub 并重启 Antigravity', '打开聊天窗口', '复制下方测试 Prompt', '粘贴到聊天中发送', '主模型自动测试全部 8 项（7 个 MCP 工具 + Skill）并生成报告'];

    return (
        <div className="animate-in" style={{ maxWidth: '860px', paddingBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                    {title}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', lineHeight: 1.5 }}>
                    {desc}
                </div>
            </div>

            {/* Steps */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '14px 16px',
                marginBottom: '12px'
            }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--vscode-editor-foreground)' }}>
                    📋 {stepsTitle}
                </div>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                    {steps.map((step, i) => (
                        <li key={i} style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', lineHeight: 1.8 }}>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* Full Test Prompt */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '14px 16px',
                marginBottom: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vscode-editor-foreground)' }}>
                        🧪 {isEN ? 'Full Test Prompt (7 items)' : '完整测试 Prompt（7 项）'}
                    </span>
                    <button
                        onClick={() => handleCopy(testPrompt)}
                        style={{
                            padding: '4px 12px', borderRadius: radius.pill, fontSize: '11px', cursor: 'pointer',
                            background: copied ? '#22c55e' : colors.brand, color: '#fff', border: 'none',
                            fontWeight: 600, transition: 'background 0.2s'
                        }}
                    >
                        {copied ? (isEN ? '✓ Copied!' : '✓ 已复制！') : (isEN ? '📋 Copy' : '📋 复制')}
                    </button>
                </div>
                <pre style={{
                    background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '12px',
                    fontSize: '11px', lineHeight: 1.6, color: 'var(--vscode-descriptionForeground)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflow: 'auto',
                    margin: 0,
                }}>
                    {testPrompt}
                </pre>
            </div>

            {/* Quick Test */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '14px 16px',
                marginBottom: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vscode-editor-foreground)' }}>
                        ⚡ {isEN ? 'Quick Connectivity Test (1 line)' : '快速连通性测试（1 行）'}
                    </span>
                    <button
                        onClick={() => handleCopy(quickTest)}
                        style={{
                            padding: '4px 12px', borderRadius: radius.pill, fontSize: '11px', cursor: 'pointer',
                            background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)',
                            border: 'none', fontWeight: 600,
                        }}
                    >
                        {isEN ? '📋 Copy' : '📋 复制'}
                    </button>
                </div>
                <pre style={{
                    background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '10px',
                    fontSize: '11px', lineHeight: 1.5, color: 'var(--vscode-descriptionForeground)',
                    whiteSpace: 'pre-wrap', margin: 0,
                }}>
                    {quickTest}
                </pre>
            </div>

            {/* Diagnostics */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '14px 16px',
            }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--vscode-editor-foreground)' }}>
                    🔍 {isEN ? 'One-Click Diagnostics' : '一键诊断'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginBottom: '10px', lineHeight: 1.5 }}>
                    {isEN
                        ? 'Generate a diagnostic report with your configuration, model status, and error logs. You can paste the report into a GitHub Issue for support.'
                        : '生成包含配置状态、模型连通性、错误日志的诊断报告。可直接粘贴到 GitHub Issue 获取支持。'}
                </div>
                <button
                    onClick={handleDiagnostic}
                    style={{
                        padding: '8px 20px', borderRadius: radius.pill, fontSize: '12px', cursor: 'pointer',
                        background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)',
                        border: 'none', fontWeight: 600,
                    }}
                >
                    {isEN ? '📊 Generate Diagnostic Report' : '📊 生成诊断报告'}
                </button>
            </div>
        </div>
    );
};

export default TestPanel;

import React from 'react';
import { vscode } from '../vscode-api';
import { colors, radius, s } from '../theme';
import { Lang } from './Dashboard';

const RoutingGuidePanel: React.FC<{ lang: Lang }> = ({ lang }) => {
    const T = {
        en: {
            title: 'Default Routing Recommendations',
            desc: 'L-Hub routes different task types to specific models by default based on benchmarking and cost-effectiveness. You can freely change these in the Models tab.',
            colTask: 'Task / Feature',
            colModel: 'Recommended Model',
            colReason: 'Reason for Recommendation',
            data: [
                { task: 'Code Generation', model: 'GPT/Codex 5.3', reason: 'Terminal-Bench #1; Codex CLI directly modifies local workspace.' },
                { task: 'Agentic Coding', model: 'MiniMax-M2.5 Coding', reason: 'SWE-bench 80.2% ≈ Claude Opus 4.6; BFCL Tool Calling 76.8% surpasses Opus.' },
                { task: 'Multi-step / Chains', model: 'GLM-5 Coding Plan', reason: 'SWE-bench 77.8% (top-tier); Outstanding long context planning.' },
                { task: 'Economical Code', model: 'DeepSeek-V3', reason: 'Unbeatable cost-effectiveness, lightning fast.' },
                { task: 'Translation / Docs', model: 'Qwen-Max', reason: 'Superior Chinese localization; Tau2-bench #1 for tool calls.' },
                { task: 'UI / Frontend', model: 'Gemini 3.1 Pro', reason: 'ARC-AGI-2 Global #1 (77.1%); Unmatched frontend design.' },
                { task: 'Math / Logic', model: 'Gemini 3.1 Pro', reason: 'GPQA 94.3%; Competitive Programming Elo 2887.' },
                { task: 'Long Context Summaries', model: 'Gemini 3.1 Pro', reason: '1M+ token context window.' },
                { task: 'Terminal / DevOps', model: 'GPT-5.3 Codex', reason: 'Terminal-Bench #1.' },
                { task: 'Creative / Mass Gen', model: 'MiniMax-M2.5 HighSpeed', reason: '100+ tokens/sec, high-speed output.' },
                { task: 'Local File Operations', model: 'Codex CLI (`ai_codex_task`)', reason: 'OAuth Login (No Key Needed); Autonomous workspace manipulation.' },
                { task: 'Local Agentic', model: 'Gemini CLI (`ai_gemini_task`)', reason: 'Google OAuth (No Key Needed); Built-in file & browser agents.' }
            ]
        },
        zh: {
            title: '默认路由推荐表',
            desc: '为了最大化性能并节约使用成本，L-Hub 默认采用以下模型推荐。这只是初始指导字典，您可以在「模型管理」中自由为任何模型分配任务。',
            colTask: '使用场景 / 任务属性',
            colModel: '推荐绑定模型',
            colReason: '核心竞争力入选理由',
            data: [
                { task: '代码生成', model: 'GPT/Codex 5.3', reason: 'Terminal-Bench #1；自带 Codex CLI 能够直接读写操作本地代码' },
                { task: 'Agentic 复杂编码', model: 'MiniMax-M2.5 Coding', reason: 'SWE-bench 80.2% ≈ Claude Opus 4.6；BFCL 工具调用 76.8% 全球第二' },
                { task: '多步调试 / 工具链', model: 'GLM-5 Coding Plan', reason: 'SWE-bench 77.8%，顶级梯队；长程任务规划能力极强' },
                { task: '代码经济型', model: 'DeepSeek-V3', reason: '无敌的性价比与极快的首字输出' },
                { task: '翻译 / 中文环境与文档', model: 'Qwen-Max', reason: '中文母语级；工具调用 Tau2-bench 称霸' },
                { task: 'UI / 前端视觉设计', model: 'Gemini 3.1 Pro', reason: 'ARC-AGI-2 全球 #1（77.1%）；美学品位独步天下' },
                { task: '极强推理 / 算法 / 数学', model: 'Gemini 3.1 Pro', reason: 'GPQA 94.3%；竞技编程水平超神（Elo 2887）' },
                { task: '超长文本 / 源码库总结', model: 'Gemini 3.1 Pro', reason: '稳定扛起百万 Token 级别的上下文洪流' },
                { task: '终端命令 / DevOps', model: 'GPT-5.3 Codex', reason: 'Terminal-Bench 霸榜选手' },
                { task: '极速生成 / 闲聊 / 脑暴', model: 'MiniMax-M2.5 HighSpeed', reason: '100 tok/s，流式体验拉满' },
                { task: '独立安全本地文件操作', model: 'Codex CLI (`ai_codex_task`)', reason: '直接走 OAuth 免 Key 嫖；以隔离全功能独立 Agent 形态干脏活' },
                { task: '系统级深度本地爬虫', model: 'Gemini CLI (`ai_gemini_task`)', reason: '走 Google OAuth 订阅额度；原厂自带视效浏览器控制系统' }
            ]
        }
    }[lang];

    return (
        <div className="animate-in" style={{ maxWidth: '860px', paddingBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                    {T.title}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', lineHeight: 1.5 }}>
                    {T.desc}
                </div>
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--vscode-editor-foreground)' }}>{T.colTask}</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--vscode-editor-foreground)' }}>{T.colModel}</th>
                            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)' }}>{T.colReason}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {T.data.map((row, i) => (
                            <tr key={i} style={{
                                borderBottom: i === T.data.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)',
                                transition: 'background 0.1s'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{ padding: '12px 16px', color: 'var(--vscode-editor-foreground)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                    {row.task}
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap' }}>
                                    {row.model}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--vscode-descriptionForeground)', lineHeight: 1.4 }}>
                                    {row.reason}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RoutingGuidePanel;

import React from 'react';
import { colors, radius, s } from '../theme';
import { Lang } from './Dashboard';

const SkillPanel: React.FC<{ lang: Lang }> = ({ lang }) => {
    const isEN = lang === 'en';

    const title = isEN ? 'Built-in AI Routing Skill' : '内置 AI 调度 Skill';
    const desc = isEN
        ? 'L-Hub auto-installs an Antigravity Skill that teaches the host model to delegate tasks intelligently, maximizing quota savings.'
        : 'L-Hub 安装后自动向 Antigravity 注入调度 Skill，教会主模型智能委派任务，最大化节省额度。';

    const sections = [
        {
            icon: '💰',
            title: isEN ? 'Routine Tasks (Low-cost Tier)' : '体力活（低成本梯队）',
            items: isEN
                ? ['Translation / Docs / Annotations → DeepSeek', 'Summaries / READMEs → DeepSeek']
                : ['翻译 / 文档 / 注释 → DeepSeek', '信息整理 / 总结 → DeepSeek']
        },
        {
            icon: '🔧',
            title: isEN ? 'Code (Quality First)' : '代码（质量优先）',
            items: isEN
                ? ['Code Review / Bug Check → Codex CLI (GPT 5.3 Codex)', 'Code Generation → Host Model (primary), Codex CLI (backup)', 'Complex Debugging → GLM-5']
                : ['代码审查 / Bug检查 → Codex CLI（GPT 5.3 Codex）', '代码生成 → 主模型首选，Codex CLI 备选', '复杂调试 / 跨文件工程 → GLM-5']
        },
        {
            icon: '🎯',
            title: isEN ? 'Specialized Domains' : '专业领域',
            items: isEN
                ? ['Reasoning / Algorithms → Gemini CLI', 'Frontend UI / UX → Gemini CLI', 'Multilingual / Structured → Qwen', 'High-speed Generation → MiniMax']
                : ['推理 / 算法 / 数学 → Gemini CLI', '前端 UI / UX → Gemini CLI', '多语言 / 结构化写作 → Qwen', '大量高速生成 → MiniMax']
        },
        {
            icon: '✍️',
            title: isEN ? 'Creative Writing Chain' : '创意写作协作链',
            items: isEN
                ? ['Outline Bidding (multi-model parallel) → Fusion → Draft Competition → Best Selection → Polish (MiniMax) → Logic Check (GLM) → Deliver']
                : ['大纲竞标（多模型并行）→ 融合 → 初稿竞写 → 择优 → 文笔打磨（MiniMax）→ 逻辑检查（GLM）→ 交付']
        }
    ];

    const tip = isEN
        ? '🛡️ Host Model Exclusive (never delegated): Architecture Design · Final Decisions · User Conversations'
        : '🛡️ 主模型专属（绝不委派）：架构设计 · 最终决策 · 与用户对话';

    const philosophy = isEN
        ? 'Design philosophy: top-tier models each excel at different tasks. Multi-model parallel + host model arbitration = best results + lowest cost.'
        : '设计哲学：顶级梯队互有胜负，不押宝单一模型。多模型并行 + 主模型裁决 = 最优结果 + 最低成本。';

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

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: '12px',
                marginBottom: '16px'
            }}>
                {sections.map((section, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: radius.md,
                        padding: '14px 16px',
                    }}>
                        <div style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--vscode-editor-foreground)',
                            marginBottom: '8px'
                        }}>
                            {section.icon} {section.title}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                            {section.items.map((item, j) => (
                                <li key={j} style={{
                                    fontSize: '12px',
                                    color: 'var(--vscode-descriptionForeground)',
                                    lineHeight: 1.7,
                                    marginBottom: '2px'
                                }}>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '12px 16px',
                marginBottom: '10px',
                fontSize: '12px',
                color: 'var(--vscode-descriptionForeground)',
            }}>
                {tip}
            </div>

            <div style={{
                fontSize: '11px',
                color: 'var(--vscode-descriptionForeground)',
                opacity: 0.7,
                fontStyle: 'italic',
                textAlign: 'center',
            }}>
                {philosophy}
            </div>
        </div>
    );
};

export default SkillPanel;

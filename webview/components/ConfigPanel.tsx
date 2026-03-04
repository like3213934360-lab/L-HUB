import React, { useState, useEffect, useCallback } from 'react';
import { vscode } from '../vscode-api';
import { s, colors, radius, shadow, providerColors } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelConfig {
    id: string;
    modelId: string;
    label: string;
    baseUrl: string;
    tasks: string[];
    enabled: boolean;
    priority: number;
}

// ─── Task Types ───────────────────────────────────────────────────────────────

const TASK_TYPES = [
    { id: 'code_gen', zh: '代码生成', en: 'Code Generation' },
    { id: 'code_review', zh: '调试 / 重构', en: 'Debug & Refactor' },
    { id: 'architecture', zh: '架构设计', en: 'Architecture' },
    { id: 'documentation', zh: '文档 / 注释', en: 'Documentation' },
    { id: 'translation', zh: '翻译', en: 'Translation' },
    { id: 'ui_design', zh: 'UI / 前端', en: 'UI & Frontend' },
    { id: 'vision', zh: '图像理解', en: 'Vision' },
    { id: 'long_context', zh: '长文本分析', en: 'Long Context' },
    { id: 'math_reasoning', zh: '数学 / 推理', en: 'Math & Reasoning' },
    { id: 'tool_calling', zh: '工具调用', en: 'Tool Calling' },
    { id: 'creative', zh: '创意写作', en: 'Creative Writing' },
    { id: 'agentic', zh: 'Agentic', en: 'Agentic Tasks' },
];

// ─── Model Registry ───────────────────────────────────────────────────────────

interface ModelDef {
    label: string;
    group: string;
    baseUrl: string;
    defaultTasks: string[];
    note: string;
    relay?: boolean;
    /** OpenRouter price as of 2026-03, USD per 1M tokens */
    pricing?: { input: number; output: number };
}

const MODEL_DEFS: Record<string, ModelDef> = {
    // ─── DeepSeek ─────────────────────────────────────────────────────────────
    'deepseek-chat': {
        label: 'V3.2',
        group: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultTasks: ['code_gen', 'code_review', 'math_reasoning'],
        note: '最新 V3.2（2025-12）综合能力强，性价比最高',
        pricing: { input: 0.32, output: 0.89 },
    },
    'deepseek-reasoner': {
        label: 'R1',
        group: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultTasks: ['math_reasoning', 'architecture', 'code_review'],
        note: 'R1 深度推理，思维链分析、数学、规划',
        pricing: { input: 0.70, output: 2.50 },
    },
    // ─── GLM (智谱) ────────────────────────────────────────────────────────────
    'glm-5': {
        label: 'GLM-5 通用',
        group: 'GLM (智谱)',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultTasks: ['architecture', 'agentic', 'tool_calling', 'code_gen'],
        note: '最新旗舰（2026-02）· 通用 API 端点 · 按量计费',
        pricing: { input: 1.50, output: 6.00 },
    },
    'glm-5-coding': {
        label: 'GLM-5 编程版',
        group: 'GLM (智谱)',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        defaultTasks: ['architecture', 'agentic', 'code_gen', 'code_review'],
        note: 'Coding Plan 包月专属端点 · 消耗 2x-3x 配额（Complex 任务）',
        pricing: undefined,
    },
    'glm-4.7': {
        label: 'GLM-4.7 编程版',
        group: 'GLM (智谱)',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        defaultTasks: ['code_gen', 'code_review', 'agentic', 'tool_calling'],
        note: 'Coding Plan 日常首选 · 1x 配额消耗 · 省额度',
        pricing: undefined,
    },
    // ─── Qwen (通义) ──────────────────────────────────────────────────────────
    'qwen-max': {
        label: 'Qwen3-Max',
        group: 'Qwen (通义)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultTasks: ['translation', 'documentation', 'tool_calling', 'code_gen'],
        note: '通义最新旗舰（Qwen3.5），中文理解与翻译最强',
        pricing: { input: 0.50, output: 4.00 },
    },
    'qwen-coder-plus': {
        label: 'Qwen Coder Plus',
        group: 'Qwen (通义)',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultTasks: ['code_gen', 'code_review', 'agentic'],
        note: '代码专项旗舰，Agentic 编程与工具调用',
        pricing: { input: 0.25, output: 2.00 },
    },
    // ─── MiniMax ──────────────────────────────────────────────────────────────
    'MiniMax-M2.5': {
        label: 'M2.5 通用',
        group: 'MiniMax',
        baseUrl: 'https://api.minimax.io/v1',
        defaultTasks: ['agentic', 'code_gen', 'tool_calling', 'long_context'],
        note: '最新旗舰（2025-12），SWE-bench 80.2%，按量计费，普通 API Key',
        pricing: { input: 0.40, output: 1.20 },
    },
    'MiniMax-M2.5-highspeed': {
        label: 'M2.5-highspeed Coding Plan',
        group: 'MiniMax',
        baseUrl: 'https://api.minimax.io/v1',
        defaultTasks: ['code_gen', 'code_review', 'agentic', 'long_context'],
        note: 'Coding Plan 包月专用，填 sk-cp-... Key · Plus 高速套餐 · 已验证可连通',
        pricing: undefined,
    },
    // ─── Kimi K2 ──────────────────────────────────────────────────────────────
    'kimi-k2-instruct': {
        label: 'Kimi K2.5 (推荐)',
        group: 'Kimi K2',
        baseUrl: 'https://api.moonshot.cn/v1',
        defaultTasks: ['agentic', 'code_gen', 'tool_calling', 'long_context'],
        note: '最新 K2.5（2026-01），1T MoE，256K 上下文，Agentic 顶尖',
        pricing: { input: 1.20, output: 4.80 },
    },
    // ─── OpenAI ───────────────────────────────────────────────────────────────
    'gpt-5.1': {
        label: 'GPT-5.1 (推荐)',
        group: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        defaultTasks: ['code_gen', 'vision', 'architecture', 'long_context'],
        note: '最新旗舰，超长上下文，复杂推理与多模态，官方直连',
        pricing: { input: 1.25, output: 10.00 },
    },
    'gpt-5.3-codex': {
        label: 'GPT-5.3 Codex (编程)',
        group: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        defaultTasks: ['code_gen', 'code_review', 'agentic', 'tool_calling'],
        note: 'Terminal-Bench #1，Agentic 编程与 DevOps 顶尖，官方直连',
        pricing: { input: 1.75, output: 14.00 },
    },
    // ─── Anthropic (Claude) ───────────────────────────────────────────────────
    'claude-opus-4-6': {
        label: 'Claude Opus 4.6 (推荐)',
        group: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['architecture', 'agentic', 'code_review', 'long_context'],
        note: '最新旗舰（2026-02），全球编程最强，企业级 Agentic，官方直连',
        pricing: { input: 15.00, output: 75.00 },
    },
    'claude-sonnet-4-6': {
        label: 'Claude Sonnet 4.6',
        group: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_gen', 'creative', 'architecture', 'documentation'],
        note: '最新（2026-02），性能与成本最佳平衡，通用主力，官方直连',
        pricing: { input: 3.00, output: 15.00 },
    },
    'claude-opus-4-5': {
        label: 'Claude Opus 4.5',
        group: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_review', 'architecture', 'agentic'],
        note: 'SWE-bench 72.5% 编程顶尖（2025-05），官方直连',
        pricing: { input: 15.00, output: 75.00 },
    },
    'claude-sonnet-4-5': {
        label: 'Claude Sonnet 4.5',
        group: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_gen', 'creative', 'documentation'],
        note: '均衡旗舰（2025-05），代码与内容创作首选，官方直连',
        pricing: { input: 3.00, output: 15.00 },
    },
    // ─── Google Gemini ────────────────────────────────────────────────────────
    'gemini-3.1-flash': {
        label: 'Gemini 3.1 Flash (推荐)',
        group: 'Google (Gemini)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['vision', 'code_gen', 'tool_calling', 'long_context'],
        note: '最新 Flash（2026），速度快成本低，多模态全能，官方直连',
        pricing: { input: 0.25, output: 1.00 },
    },
    'gemini-3.1-pro-preview': {
        label: 'Gemini 3.1 Pro Preview',
        group: 'Google (Gemini)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['math_reasoning', 'architecture', 'long_context', 'vision'],
        note: '顶级推理，百万 token 上下文，官方直连',
        pricing: { input: 1.25, output: 5.00 },
    },
    'gemini-3-image': {
        label: 'Gemini Image Gen (生图)',
        group: 'Google (Gemini)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['vision', 'creative', 'ui_design'],
        note: '专用图像生成与编辑（Imagen 3 驱动），官方直连',
        pricing: { input: 0.25, output: 1.50 },
    },
    // ─── Mistral ──────────────────────────────────────────────────────────────
    'mistral-large-latest': {
        label: 'Mistral Large 3 (推荐)',
        group: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultTasks: ['translation', 'tool_calling', 'code_gen'],
        note: '欧洲隐私合规，多语言优秀，官方直连',
        pricing: { input: 2.00, output: 6.00 },
    },
    // ─── Meta Llama (中转) ────────────────────────────────────────────────────
    'meta-llama/llama-3.3-70b-instruct': {
        label: 'Llama 3.3 70B',
        group: 'Meta (Llama) — 需中转',
        baseUrl: '',
        defaultTasks: ['code_gen', 'translation'],
        note: '业界顶级梯队模型，需通过 OpenRouter / 硅基流动等中转',
        relay: true,
    },
    // ─── API 聚合平台 ─────────────────────────────────────────────────────────
    '__openrouter__': {
        label: 'OpenRouter',
        group: 'API 聚合平台',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultTasks: ['code_gen', 'architecture', 'translation'],
        note: '全球最大聚合（500+ 模型）。Model ID 格式：openai/gpt-5.1 · anthropic/claude-sonnet-4-6',
        relay: true,
    },
    '__yibuapi__': {
        label: '一步API',
        group: 'API 聚合平台',
        baseUrl: 'https://api.yibuapi.com/v1',
        defaultTasks: ['code_gen', 'translation'],
        note: '国内聚合，原价调用 GPT/Claude/Gemini/DeepSeek/Qwen/Kimi，无需科学上网',
        relay: true,
    },
    '__dmxapi__': {
        label: 'DMXAPI',
        group: 'API 聚合平台',
        baseUrl: 'https://www.dmxapi.cn/v1',
        defaultTasks: ['code_gen', 'translation'],
        note: '国内稳定聚合，Model ID 与官方一致',
        relay: true,
    },
    // ─── 自定义 ───────────────────────────────────────────────────────────────
    '__custom__': {
        label: '自定义模型',
        group: '自定义接口',
        baseUrl: '',
        defaultTasks: [],
        note: '任意兼容 OpenAI 接口的模型（中转、私有部署等）',
        relay: true,
    },
};

/** Example model IDs shown in the Model ID input per provider group */
const GROUP_MODEL_EXAMPLES: Record<string, string> = {
    'DeepSeek': 'deepseek-chat / deepseek-reasoner',
    'GLM (智谱)': 'glm-5 / glm-4.7',
    'Qwen (通义)': 'qwen-max / qwen-plus',
    'MiniMax': 'MiniMax-M2.5 / MiniMax-M2.5-highspeed',
    'Kimi K2': 'kimi-k2-0711-preview',
    'Anthropic (Claude)': 'claude-opus-4-5 / claude-sonnet-4-5',
    'OpenAI': 'gpt-4o / gpt-4.1',
    'Google (Gemini)': 'gemini-2.0-flash / gemini-1.5-pro',
    'Mistral': 'mistral-large / mistral-small',
};

const GROUPS = [
    // 官方直连（国内）
    'DeepSeek',
    'GLM (智谱)',
    'Qwen (通义)',
    'MiniMax',
    'Kimi K2',
    // 官方直连（国际）
    'OpenAI',
    'Anthropic (Claude)',
    'Google (Gemini)',
    'Mistral',
    // 第三方中转
    '第三方中转',
    // 自定义
    '自定义接口',
];

/** Verified relay platforms with HTTPS, proper websites, and good reputation */
const RELAY_PRESETS = [
    { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', site: 'https://openrouter.ai', note: '国际标杆，模型最全（500+）' },
    { name: 'UniAPI 内地 HK', url: 'https://hk.uniapi.io/v1', site: 'https://uniapi.io', note: '大陆优化线路，国内首选' },
    { name: 'UniAPI 国际', url: 'https://api.uniapi.io/v1', site: 'https://uniapi.io', note: '国际线路，支持 GPT/Claude/Gemini/DeepSeek' },
    { name: 'CloseAI', url: 'https://api.closeai-asia.com/v1', site: 'https://closeai-asia.com', note: '亚洲企业级中转' },
    { name: '硅基流动 SiliconFlow', url: 'https://api.siliconflow.cn/v1', site: 'https://cloud.siliconflow.cn', note: '国内正规大平台' },
];

// Provider colors imported from theme.ts

/** All models with known pricing, for the reference table */
const PRICE_TABLE = Object.entries(MODEL_DEFS)
    .filter(([, d]) => d.pricing)
    .sort((a, b) => (a[1].pricing!.input - b[1].pricing!.input))
    .map(([id, d]) => ({ id, label: d.label, group: d.group, pricing: d.pricing! }));

/** Format a USD price as CNY (zh) or USD (en). Rate: 1 USD ≈ 7.3 CNY */
const USD_TO_CNY = 7.3;
const formatPrice = (usd: number, lang: string) => {
    if (lang === 'zh') {
        const cny = usd * USD_TO_CNY;
        return `¥${cny < 10 ? cny.toFixed(2) : cny.toFixed(1)}`;
    }
    return `$${usd.toFixed(2)}`;
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

// Styles imported from '../theme' — s, colors, radius, shadow, providerColors

// ─── TaskBadge ────────────────────────────────────────────────────────────────

const TaskBadge: React.FC<{ id: string; lang: string }> = ({ id, lang }) => {
    const t = TASK_TYPES.find(t => t.id === id);
    if (!t) { return null; }
    return (
        <span style={{
            display: 'inline-block',
            margin: '2px 3px 2px 0',
            padding: '1px 7px',
            borderRadius: '3px',
            fontSize: '11px',
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
            whiteSpace: 'nowrap',
        }}>
            {lang === 'zh' ? t.zh : t.en}
        </span>
    );
};

// ─── ModelCard ────────────────────────────────────────────────────────────────

const ModelCard: React.FC<{
    model: ModelConfig;
    apiKey: string;
    lang: string;
    initialTestResult?: { ok: boolean; msg: string };
    onEdit: (m: ModelConfig, key: string) => void;
    onRemove: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}> = ({ model, apiKey, lang, initialTestResult, onEdit, onRemove, onToggle }) => {
    const def = MODEL_DEFS[model.modelId];
    const [testState, setTestState] = React.useState<'idle' | 'testing' | 'ok' | 'fail'>(
        initialTestResult ? (initialTestResult.ok ? 'ok' : 'fail') : 'idle'
    );
    const [testMsg, setTestMsg] = React.useState(initialTestResult?.msg || '');
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    // Update when auto-test result arrives from parent
    React.useEffect(() => {
        if (initialTestResult) {
            setTestState(initialTestResult.ok ? 'ok' : 'fail');
            setTestMsg(initialTestResult.msg);
        }
    }, [initialTestResult?.ok, initialTestResult?.msg]);

    const handleTest = async () => {
        if (!apiKey) { setTestState('fail'); setTestMsg(lang === 'zh' ? '未配置 API Key' : 'API Key not set'); return; }
        if (!model.baseUrl) { setTestState('fail'); setTestMsg('Base URL 未设置'); return; }
        setTestState('testing'); setTestMsg('');
        // Route through extension host (Node.js) to bypass CORS restrictions
        const requestId = `test_${Date.now()}`;
        vscode.postMessage({ command: 'testConnection', modelId: model.modelId, baseUrl: model.baseUrl, apiKey, requestId });
        // Listen for the response
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg.command === 'testResult' && msg.requestId === requestId) {
                window.removeEventListener('message', handler);
                setTestState(msg.ok ? 'ok' : 'fail');
                setTestMsg(msg.msg || (msg.ok ? '已连通' : '失败'));
            }
        };
        window.addEventListener('message', handler);
        // Fallback cleanup after 17s
        setTimeout(() => {
            window.removeEventListener('message', handler);
            setTestState(s => s === 'testing' ? 'fail' : s);
            setTestMsg(m => m === '' ? '超时 15s' : m);
        }, 17000);
    };

    const testColor = testState === 'ok'
        ? 'var(--vscode-testing-iconPassed)'
        : testState === 'fail' ? 'var(--vscode-errorForeground)'
            : 'var(--vscode-descriptionForeground)';

    return (
        <div style={{
            ...s.card,
            opacity: model.enabled ? 1 : 0.55,
            borderLeft: `3px solid ${providerColors[def?.group || ''] || colors.brand}`,
            position: 'relative' as const,
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Group name (big) + model label (small subtitle) + price */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{def?.group || model.modelId}</span>
                        <span style={{ fontSize: '11px', color: providerColors[def?.group || ''] || 'var(--vscode-descriptionForeground)', fontWeight: 500 }}>{model.label}</span>
                        {def?.pricing && (
                            <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-input-border)', borderRadius: '3px', padding: '0 5px' }}>
                                {formatPrice(def.pricing.input, lang)} / {formatPrice(def.pricing.output, lang)} per M
                            </span>
                        )}
                    </div>
                    {/* Description */}
                    {def && (
                        <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', margin: '3px 0 7px' }}>
                            {def.note}
                        </div>
                    )}
                    {/* Task badges */}
                    <div>
                        {model.tasks.length > 0
                            ? model.tasks.map(t => <TaskBadge key={t} id={t} lang={lang} />)
                            : <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>未分配任务</span>
                        }
                    </div>
                </div>
                {/* Actions: Test + Disable + Edit + Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                        onClick={handleTest}
                        disabled={testState === 'testing'}
                        style={{
                            ...s.btnSecondary, padding: '3px 10px', fontSize: '11px',
                            cursor: testState === 'testing' ? 'default' : 'pointer',
                        }}
                    >
                        {testState === 'testing' ? (lang === 'zh' ? '测试中…' : 'Testing…') : (lang === 'zh' ? '测试连通' : 'Test')}
                    </button>
                    <button
                        style={{ ...s.btnSecondary, padding: '3px 10px', fontSize: '11px' }}
                        onClick={() => onToggle(model.id, !model.enabled)}
                    >
                        {model.enabled ? (lang === 'zh' ? '禁用' : 'Disable') : (lang === 'zh' ? '启用' : 'Enable')}
                    </button>
                    <button
                        style={{ ...s.btnSecondary, padding: '3px 10px', fontSize: '11px' }}
                        onClick={() => onEdit(model, apiKey)}
                    >
                        {lang === 'zh' ? '编辑' : 'Edit'}
                    </button>
                    {!confirmDelete ? (
                        <button
                            style={{ ...s.btnSecondary, padding: '3px 10px', fontSize: '11px', color: 'var(--vscode-errorForeground)' }}
                            onClick={() => setConfirmDelete(true)}
                        >
                            {lang === 'zh' ? '删除' : 'Delete'}
                        </button>
                    ) : (
                        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: 'var(--vscode-errorForeground)' }}>{lang === 'zh' ? '确认?' : 'Sure?'}</span>
                            <button
                                style={{ ...s.btnSecondary, padding: '2px 8px', fontSize: '11px', background: 'var(--vscode-errorForeground)', color: '#fff', border: 'none' }}
                                onClick={() => { setConfirmDelete(false); onRemove(model.id); }}
                            >
                                {lang === 'zh' ? '确认删除' : 'Yes'}
                            </button>
                            <button
                                style={{ ...s.btnSecondary, padding: '2px 8px', fontSize: '11px' }}
                                onClick={() => setConfirmDelete(false)}
                            >
                                {lang === 'zh' ? '取消' : 'No'}
                            </button>
                        </span>
                    )}
                </div>
            </div>
            {/* Footer: URL + key status · test result at bottom-right */}
            <div style={{ marginTop: '7px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <span>{model.baseUrl || '(未设置 Base URL)'}</span>
                    <span style={{ color: apiKey ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-errorForeground)' }}>
                        {apiKey ? (lang === 'zh' ? 'API Key 已配置' : 'API Key set') : (lang === 'zh' ? 'API Key 未配置' : 'API Key missing')}
                    </span>
                </span>
                {testState !== 'idle' && (
                    <span style={{ color: testColor, fontWeight: 500 }}>
                        {testState === 'testing' ? (lang === 'zh' ? '测试中…' : 'Testing…') : testState === 'ok' ? `✅ ${testMsg}` : `❌ ${testMsg}`}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── AddEditModal ─────────────────────────────────────────────────────────────

const AddEditModal: React.FC<{
    lang: string;
    existing?: { model: ModelConfig; apiKey: string };
    onSave: (model: ModelConfig, apiKey: string) => void;
    onClose: () => void;
}> = ({ lang, existing, onSave, onClose }) => {
    const isEdit = !!existing;

    const [selectedGroup, setSelectedGroup] = useState(() => {
        if (existing) {
            // Try MODEL_DEFS lookup first (covers known models)
            const fromDef = MODEL_DEFS[existing.model.modelId]?.group;
            if (fromDef) return fromDef;
            // Fallback: detect from baseUrl pattern
            const url = existing.model.baseUrl || '';
            if (url.includes('bigmodel.cn') || url.includes('zhipuai')) return 'GLM (智谱)';
            if (url.includes('dashscope') || url.includes('aliyuncs')) return 'Qwen (通义)';
            if (url.includes('minimax') || url.includes('minimaxi')) return 'MiniMax';
            if (url.includes('moonshot') || url.includes('kimi')) return 'Kimi K2';
            if (url.includes('deepseek')) return 'DeepSeek';
            if (url.includes('anthropic') || url.includes('claude')) return '官方直连（国际）';
            if (url.includes('openai') || url.includes('googleapis')) return '官方直连（国际）';
        }
        return GROUPS[0];
    });
    const [selectedModelId, setSelectedModelId] = useState(existing?.model.modelId || '');
    const [customModelId, setCustomModelId] = useState(existing?.model.modelId || '');
    const [customLabel, setCustomLabel] = useState(existing?.model.label || '');
    const [baseUrl, setBaseUrl] = useState(existing?.model.baseUrl || '');
    const [tasks, setTasks] = useState<string[]>(existing?.model.tasks || []);
    const [apiKey, setApiKey] = useState(existing?.apiKey || '');
    const [step, setStep] = useState(existing ? 2 : 1);

    const isCustomGroup = selectedGroup === '自定义接口';
    const isRelayGroup = selectedGroup === '第三方中转';
    const modelsInGroup = isRelayGroup
        ? Object.entries(MODEL_DEFS).filter(([, d]) => d.group !== '自定义接口' && d.group !== '第三方中转')
        : Object.entries(MODEL_DEFS).filter(([, d]) => d.group === selectedGroup && d.group !== '自定义接口');
    const effectiveModelId = isCustomGroup ? '__custom__' : selectedModelId;
    const def = MODEL_DEFS[effectiveModelId];

    const handleGroupChange = (g: string) => {
        setSelectedGroup(g);
        const isRelay = g === '第三方中转';
        // For relay group, pick first available model from all providers
        const candidates = isRelay
            ? Object.entries(MODEL_DEFS).filter(([, d]) => d.group !== '自定义接口' && d.group !== '第三方中转')
            : Object.entries(MODEL_DEFS).filter(([, d]) => d.group === g && d.group !== '自定义接口');
        const first = candidates[0];
        if (first) {
            setSelectedModelId(first[0]);
            // For relay, clear baseUrl so user must pick a platform
            setBaseUrl(isRelay ? '' : first[1].baseUrl);
            setTasks(first[1].defaultTasks);
        } else {
            setSelectedModelId('');
            setBaseUrl('');
            setTasks([]);
        }
    };

    const handleModelChange = (id: string) => {
        setSelectedModelId(id);
        const d = MODEL_DEFS[id];
        if (d) {
            setBaseUrl(d.baseUrl);
            setTasks(d.defaultTasks);
        }
    };

    const toggleTask = (id: string) => {
        setTasks(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const handleSave = () => {
        const finalModelId = isCustomGroup ? customModelId : selectedModelId;
        if (!finalModelId) { alert('请选择或填写型号'); return; }
        if (isRelayGroup && !baseUrl) { alert('第三方中转需要填写 Base URL'); return; }

        const finalLabel = isCustomGroup
            ? (customLabel || customModelId)
            : (MODEL_DEFS[finalModelId]?.label || finalModelId);

        const config: ModelConfig = {
            id: existing?.model.id || `mc_${Date.now()}`,
            modelId: finalModelId,
            label: finalLabel,
            baseUrl,
            tasks,
            enabled: existing?.model.enabled ?? true,
            priority: existing?.model.priority ?? 0,
        };
        onSave(config, apiKey);
    };

    const overlay: React.CSSProperties = {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    };
    const modal: React.CSSProperties = {
        background: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '8px', padding: '22px 24px',
        width: '500px', maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto',
    };

    const stepHeader = (n: number, title: string) => (
        <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '14px' }}>{isEdit ? '编辑模型' : `步骤 ${n}/3 — ${title}`}</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--vscode-descriptionForeground)' }} onClick={onClose}>✕</button>
            </div>
            <div style={{ height: '1px', background: 'var(--vscode-panel-border)' }} />
        </div>
    );

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) { onClose(); } }}>
            <div style={modal}>
                {/* Step 1: Provider + model */}
                {step === 1 && (
                    <>
                        {stepHeader(1, '选择模型')}

                        <div style={{ marginBottom: '14px' }}>
                            <label style={s.label}>{lang === 'zh' ? '提供商' : 'Provider'}</label>
                            <select style={s.select} value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}>
                                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        {!isCustomGroup && (
                            <div style={{ marginBottom: '14px' }}>
                                <label style={s.label}>{lang === 'zh' ? '型号' : 'Model'}</label>
                                {isRelayGroup ? (
                                    <select style={s.select} value={selectedModelId} onChange={e => handleModelChange(e.target.value)}>
                                        {(() => {
                                            const grouped: Record<string, [string, ModelDef][]> = {};
                                            modelsInGroup.forEach(([id, d]) => {
                                                (grouped[d.group] = grouped[d.group] || []).push([id, d]);
                                            });
                                            return Object.entries(grouped).map(([group, models]) => (
                                                <optgroup key={group} label={group}>
                                                    {models.map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
                                                </optgroup>
                                            ));
                                        })()}
                                    </select>
                                ) : (
                                    <select style={s.select} value={selectedModelId} onChange={e => handleModelChange(e.target.value)}>
                                        {modelsInGroup.map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}
                                    </select>
                                )}
                                {def && <p style={s.hint}>{def.note}</p>}
                                {isRelayGroup && (
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={s.label}>{lang === 'zh' ? '中转平台（点击快速填入）' : 'Relay Platform (click to fill Base URL)'}</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                            {RELAY_PRESETS.map(r => (
                                                <button
                                                    key={r.name}
                                                    onClick={() => setBaseUrl(r.url)}
                                                    style={{
                                                        ...s.btnSecondary, fontSize: '11px', padding: '4px 10px',
                                                        background: baseUrl === r.url ? 'var(--vscode-button-background)' : undefined,
                                                        color: baseUrl === r.url ? 'var(--vscode-button-foreground)' : undefined,
                                                    }}
                                                >
                                                    {r.name}
                                                </button>
                                            ))}
                                        </div>
                                        {RELAY_PRESETS.map(r => baseUrl === r.url && (
                                            <p key={r.name} style={{ ...s.hint, marginTop: '6px' }}>
                                                {r.note} — <a href={r.site} style={{ color: 'var(--vscode-textLink-foreground)' }}>注册 / 获取 Key ↗</a>
                                            </p>
                                        ))}
                                        <div style={{ marginTop: '8px' }}>
                                            <label style={s.label}>Base URL</label>
                                            <input style={s.input} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-relay.com/v1" />
                                        </div>
                                    </div>
                                )}
                                {!isRelayGroup && def?.relay && (
                                    <p style={{ ...s.hint, color: 'var(--vscode-errorForeground)', marginTop: '6px' }}>
                                        此模型需要中转服务，下一步填写中转地址。
                                    </p>
                                )}
                            </div>
                        )}

                        {isCustomGroup && (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={s.label}>Model ID <span style={{ fontWeight: 400, opacity: 0.7 }}>(接口中使用的模型名称)</span></label>
                                    <input style={s.input} value={customModelId} onChange={e => setCustomModelId(e.target.value)} placeholder="e.g. gpt-4o / claude-3-5-sonnet-20241022" />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={s.label}>显示名称 <span style={{ fontWeight: 400, opacity: 0.7 }}>(在列表里显示的名字)</span></label>
                                    <input style={s.input} value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="e.g. 我的专属模型" />
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                            <button style={s.btnSecondary} onClick={onClose}>取消</button>
                            <button style={s.btnPrimary} onClick={() => setStep(2)} disabled={!isCustomGroup && !selectedModelId}>
                                下一步
                            </button>
                        </div>
                    </>
                )}

                {/* Step 2: Tasks + Base URL */}
                {step === 2 && (
                    <>
                        {stepHeader(2, '任务分配')}

                        {isEdit && (
                            <div style={{ marginBottom: '14px' }}>
                                <label style={s.label}>Model ID <span style={{ fontWeight: 400, opacity: 0.7 }}>{`(可直接修改型号，如 ${GROUP_MODEL_EXAMPLES[selectedGroup] ?? 'glm-5 / glm-4.7'})`}</span></label>
                                <input
                                    style={s.input}
                                    value={isCustomGroup ? customModelId : selectedModelId}
                                    onChange={e => isCustomGroup ? setCustomModelId(e.target.value) : setSelectedModelId(e.target.value)}
                                    placeholder={GROUP_MODEL_EXAMPLES[selectedGroup] ?? '如 glm-5、deepseek-chat、MiniMax-M2.5'}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ ...s.label, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>
                                    {lang === 'zh' ? '任务类型（多选）' : 'Task Types (multi-select)'}
                                    <span style={{ fontWeight: 400, fontSize: '11px', opacity: 0.65, marginLeft: '8px' }}>
                                        已按模型特点预设，可自由修改
                                    </span>
                                </span>
                                {def?.defaultTasks && (
                                    <button
                                        style={{ ...s.btnSecondary, padding: '2px 8px', fontSize: '10px', marginLeft: '8px' }}
                                        onClick={() => setTasks([...(def?.defaultTasks || [])])}
                                    >
                                        {lang === 'zh' ? '恢复默认' : 'Reset'}
                                    </button>
                                )}
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {TASK_TYPES.map(t => {
                                    const sel = tasks.includes(t.id);
                                    return (
                                        <span
                                            key={t.id}
                                            onClick={() => toggleTask(t.id)}
                                            style={{
                                                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                                                background: sel ? 'var(--vscode-button-background)' : 'var(--vscode-input-background)',
                                                color: sel ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                                                border: '1px solid var(--vscode-input-border)',
                                                userSelect: 'none',
                                            }}
                                        >
                                            {lang === 'zh' ? t.zh : t.en}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={s.label}>
                                Base URL
                                {def?.relay && (
                                    <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--vscode-errorForeground)', marginLeft: '6px' }}>
                                        此模型需要填写中转服务地址
                                    </span>
                                )}
                            </label>
                            <input style={s.input} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.xxx.com/v1" />
                            <p style={s.hint}>
                                {def?.relay
                                    ? '推荐中转：OpenRouter (openrouter.ai) · 硅基流动 (siliconflow.cn)'
                                    : '已自动填入官方地址，如使用中转服务可修改。'
                                }
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                            <button style={s.btnPrimary} onClick={() => setStep(1)}>上一步</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={s.btnSecondary} onClick={onClose}>取消</button>
                                <button style={s.btnPrimary} onClick={() => setStep(3)}>下一步</button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 3: API Key */}
                {step === 3 && (
                    <>
                        {stepHeader(3, 'API Key')}

                        <div style={{ marginBottom: '6px' }}>
                            <label style={s.label}>API Key</label>
                            <input type="password" style={s.input} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
                            <p style={s.hint}>加密存储，不会明文保存到磁盘。</p>
                        </div>

                        {/* API Key links by group */}
                        {(() => {
                            const links: Record<string, { text: string; url: string }> = {
                                'DeepSeek': { text: '申请 DeepSeek Key', url: 'https://platform.deepseek.com' },
                                'GLM (智谱)': { text: '申请智谱 Key', url: 'https://open.bigmodel.cn' },
                                'Qwen (通义)': { text: '申请通义 Key', url: 'https://dashscope.aliyun.com' },
                                'MiniMax': { text: '申请 MiniMax Key', url: 'https://api.minimax.chat' },
                                'Moonshot (Kimi)': { text: '申请 Kimi Key', url: 'https://platform.moonshot.cn' },
                                'OpenAI': { text: '申请 OpenAI Key', url: 'https://platform.openai.com/api-keys' },
                                'Anthropic (Claude)': { text: '申请 Claude Key', url: 'https://console.anthropic.com' },
                                'Google (Gemini)': { text: '申请 Gemini Key', url: 'https://aistudio.google.com/apikey' },
                            };
                            const g = isEdit ? (MODEL_DEFS[existing!.model.modelId]?.group || '') : selectedGroup;
                            const link = links[g];
                            if (!link) { return null; }
                            return (
                                <p style={{ ...s.hint, marginTop: '10px' }}>
                                    还没有 Key？
                                    <a href={link.url} style={{ color: 'var(--vscode-textLink-foreground)', marginLeft: '4px', cursor: 'pointer' }}
                                        onClick={e => { e.preventDefault(); vscode.postMessage({ command: 'openUrl', url: link.url }); }}>
                                        {link.text}
                                    </a>
                                </p>
                            );
                        })()}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                            <button style={s.btnPrimary} onClick={() => setStep(2)}>上一步</button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={s.btnSecondary} onClick={onClose}>取消</button>
                                <button style={s.btnPrimary} onClick={handleSave}>保存</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

export interface ConfigPanelProps { lang: 'zh' | 'en'; }

const ConfigPanel: React.FC<ConfigPanelProps> = ({ lang }) => {
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<{ model: ModelConfig; apiKey: string } | undefined>();
    const [showPricing, setShowPricing] = useState(false);
    const [showRouting, setShowRouting] = useState(false);
    const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
    const [codexStatus, setCodexStatus] = useState<{ installed: boolean; version?: string; loggedIn?: boolean } | null>(null);
    const [geminiStatus, setGeminiStatus] = useState<{ installed: boolean; version?: string; loggedIn?: boolean } | null>(null);
    const hasAutoTested = React.useRef(false);

    useEffect(() => {
        const handler = (ev: MessageEvent) => {
            if (ev.data.command === 'loadModelsV2') {
                const loadedModels: ModelConfig[] = ev.data.models || [];
                const loadedKeys: Record<string, string> = ev.data.apiKeys || {};
                setModels(loadedModels);
                setApiKeys(loadedKeys);
                // Only auto-test on first load, not on every tab switch
                if (!hasAutoTested.current) {
                    hasAutoTested.current = true;
                    setTimeout(() => {
                        loadedModels.forEach((m) => {
                            const key = loadedKeys[m.id];
                            if (!key || !m.baseUrl || !m.enabled) return;
                            const requestId = `autotest_${m.id}_${Date.now()}`;
                            vscode.postMessage({ command: 'testConnection', modelId: m.modelId, baseUrl: m.baseUrl, apiKey: key, requestId });
                        });
                    }, 2000);
                }
            }
            // Handle auto-test results (same handler as manual test)
            if (ev.data.command === 'testResult' && ev.data.requestId?.startsWith('autotest_')) {
                // Extract model config id from requestId: autotest_{configId}_{timestamp}
                const parts = ev.data.requestId.split('_');
                const configId = parts.slice(1, -1).join('_');
                setTestResults(prev => ({ ...prev, [configId]: { ok: ev.data.ok, msg: ev.data.ok ? '已连通' : (ev.data.msg || '失败') } }));
            }
            if (ev.data.command === 'codexStatus') {
                setCodexStatus({ installed: ev.data.installed, version: ev.data.version, loggedIn: ev.data.loggedIn });
            }
            if (ev.data.command === 'geminiStatus') {
                setGeminiStatus({ installed: ev.data.installed, version: ev.data.version, loggedIn: ev.data.loggedIn });
            }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({ command: 'getModelsV2' });
        vscode.postMessage({ command: 'getCodexStatus' });
        vscode.postMessage({ command: 'getGeminiStatus' });
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleSave = useCallback((modelConfig: ModelConfig, apiKey: string) => {
        if (editTarget) {
            vscode.postMessage({ command: 'updateModel', id: modelConfig.id, patch: modelConfig, apiKey });
        } else {
            vscode.postMessage({ command: 'addModel', modelConfig, apiKey });
        }
        setShowModal(false);
        setEditTarget(undefined);
    }, [editTarget]);

    const handleEdit = (model: ModelConfig, key: string) => { setEditTarget({ model, apiKey: key }); setShowModal(true); };
    const handleRemove = (id: string) => vscode.postMessage({ command: 'removeModel', id });
    const handleToggle = (id: string, enabled: boolean) => {
        vscode.postMessage({ command: 'updateModel', id, patch: { enabled } });
        setModels(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    };

    const enabled = models.filter(m => m.enabled).length;

    return (
        <div style={{ maxWidth: '700px', paddingBottom: '40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '15px' }}>
                        {lang === 'zh' ? '模型管理' : 'Model Management'}
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                        {lang === 'zh'
                            ? `${enabled} 个模型已启用 · 按任务类型自动路由`
                            : `${enabled} model(s) enabled · L-Hub auto-routes each task to the matching model`}
                    </p>
                </div>
                <button style={s.btnPrimary} onClick={() => { setEditTarget(undefined); setShowModal(true); }}>
                    {lang === 'zh' ? '+ 添加模型' : '+ Add Model'}
                </button>
            </div>

            {/* List */}
            {models.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '50px 20px',
                    color: 'var(--vscode-descriptionForeground)',
                    border: '1px dashed var(--vscode-panel-border)',
                    borderRadius: '6px',
                }}>
                    <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                        {lang === 'zh' ? '尚未配置任何模型' : 'No models configured'}
                    </div>
                    <div style={{ fontSize: '12px' }}>
                        {lang === 'zh' ? '点击「+ 添加模型」开始' : 'Click "+ Add Model" to get started'}
                    </div>
                </div>
            ) : (
                models.map(m => (
                    <ModelCard
                        key={m.id} model={m} apiKey={apiKeys[m.id] || ''}
                        lang={lang} onEdit={handleEdit} onRemove={handleRemove} onToggle={handleToggle}
                        initialTestResult={testResults[m.id]}
                    />
                ))
            )}

            {/* Codex CLI (ChatGPT OAuth) Card */}
            <div style={{ ...s.card, marginTop: '18px', borderLeft: `3px solid ${codexStatus?.installed ? '#10A37F' : '#E8740C'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {codexStatus === null ? '🔍 检测 Codex CLI…' : codexStatus.installed ? '✅ Codex CLI 已安装' : '⚠️ Codex CLI 未安装'}
                        </span>
                        {codexStatus?.version && <span style={{ marginLeft: '8px', opacity: 0.6, fontSize: '11px' }}>v{codexStatus.version}</span>}
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                            {codexStatus?.installed
                                ? (codexStatus.loggedIn
                                    ? 'ChatGPT 账号已登录 · ai_codex_task 工具可用 · 无需 API Key'
                                    : 'Codex CLI 已安装 · 使用前需先登录 ChatGPT 账号')
                                : '安装后可用 ChatGPT Plus 账号直接调用，无需 API Key'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {!codexStatus?.installed && (
                            <button
                                style={{ ...s.btnPrimary, fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => vscode.postMessage({ command: 'openTerminalWithCmd', cmd: 'npm install -g @openai/codex && codex login' })}
                            >
                                安装并登录
                            </button>
                        )}
                        {codexStatus?.installed && (
                            <button
                                style={{ ...s.btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => vscode.postMessage({ command: 'openTerminalWithCmd', cmd: 'codex login' })}
                            >
                                重新登录
                            </button>
                        )}
                        <button style={{ ...s.btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => vscode.postMessage({ command: 'openUrl', url: 'https://github.com/openai/codex' })}>
                            文档
                        </button>
                    </div>
                </div>
                {codexStatus?.installed && codexStatus.loggedIn && (
                    <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '11px', color: '#10A37F', fontWeight: 500 }}>✅ 已连通</div>
                )}
            </div>

            {/* Gemini CLI Card */}
            <div style={{ ...s.card, marginTop: '12px', borderLeft: `3px solid ${geminiStatus?.installed ? '#4285F4' : '#E8740C'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {geminiStatus === null ? '🔍 检测 Gemini CLI…' : geminiStatus.installed ? '✅ Gemini CLI 已安装' : '⚠️ Gemini CLI 未安装'}
                        </span>
                        {geminiStatus?.version && <span style={{ marginLeft: '8px', opacity: 0.6, fontSize: '11px' }}>v{geminiStatus.version}</span>}
                        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                            {geminiStatus?.installed
                                ? (geminiStatus.loggedIn
                                    ? 'Google 账号已登录 · ai_gemini_task 工具可用 · 无需 API Key'
                                    : 'Gemini CLI 已安装 · 使用前需先登录 Google 账号')
                                : '安装后可用 Google 账号本地凭据调用，无需 API Key'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {!geminiStatus?.installed && (
                            <button
                                style={{ ...s.btnPrimary, fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => vscode.postMessage({ command: 'openTerminalWithCmd', cmd: 'npm install -g @google/gemini-cli && gemini' })}
                            >
                                安装并登录
                            </button>
                        )}
                        {geminiStatus?.installed && (
                            <button
                                style={{ ...s.btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                                onClick={() => vscode.postMessage({ command: 'openTerminalWithCmd', cmd: 'gemini' })}
                            >
                                重新登录
                            </button>
                        )}
                        <button style={{ ...s.btnSecondary, fontSize: '11px', padding: '4px 10px' }}
                            onClick={() => vscode.postMessage({ command: 'openUrl', url: 'https://github.com/google/gemini-cli' })}>
                            文档
                        </button>
                    </div>
                </div>
                {geminiStatus?.installed && geminiStatus.loggedIn && (
                    <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '11px', color: '#4285F4', fontWeight: 500 }}>✅ 已连通</div>
                )}
            </div>

            {/* Pricing Reference Table */}
            <div style={{ marginTop: '18px' }}>
                <button
                    onClick={() => setShowPricing(!showPricing)}
                    style={{
                        ...s.btnSecondary,
                        width: '100%', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                >
                    <span>{lang === 'zh' ? '模型价格参考（OpenRouter 数据）' : 'Pricing Reference (OpenRouter Data)'}</span>
                    <span style={{ fontSize: '10px' }}>{showPricing ? '▲' : '▼'}</span>
                </button>
                {showPricing && (
                    <div style={{
                        marginTop: '6px', border: '1px solid var(--vscode-input-border)',
                        borderRadius: '4px', overflow: 'hidden',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ background: 'var(--vscode-editor-inactiveSelectionBackground)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>
                                        {lang === 'zh' ? '模型' : 'Model'}
                                    </th>
                                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>
                                        {lang === 'zh' ? '厂商' : 'Provider'}
                                    </th>
                                    <th style={{ padding: '6px 10px', fontWeight: 600, textAlign: 'right' }}>
                                        {lang === 'zh' ? '输入 $/M' : 'Input $/M'}
                                    </th>
                                    <th style={{ padding: '6px 10px', fontWeight: 600, textAlign: 'right' }}>
                                        {lang === 'zh' ? '输出 $/M' : 'Output $/M'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {PRICE_TABLE.map((row, i) => (
                                    <tr key={row.id} style={{
                                        background: i % 2 === 0 ? 'transparent' : 'var(--vscode-editor-inactiveSelectionBackground)',
                                        borderTop: '1px solid var(--vscode-input-border)',
                                    }}>
                                        <td style={{ padding: '5px 10px' }}>{row.label}</td>
                                        <td style={{ padding: '5px 10px', color: providerColors[row.group] || 'inherit', fontWeight: 500 }}>{row.group}</td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                            {formatPrice(row.pricing.input, lang)}
                                        </td>
                                        <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                                            {formatPrice(row.pricing.output, lang)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{
                            padding: '6px 10px', fontSize: '10px',
                            color: 'var(--vscode-descriptionForeground)',
                            borderTop: '1px solid var(--vscode-input-border)',
                        }}>
                            {lang === 'zh'
                                ? `价格来源：OpenRouter（2026-03），单位：人民币/百万 tokens（汇率 $1=¥${USD_TO_CNY}）。直连官方 API 价格可能不同。`
                                : 'Source: OpenRouter (2026-03). USD per million tokens. Direct API pricing may vary.'}
                        </div>
                    </div>
                )}
            </div>

            {/* Routing Recommendation Table */}
            <div style={{ marginTop: '18px' }}>
                <button
                    onClick={() => setShowRouting(!showRouting)}
                    style={{
                        ...s.btnSecondary,
                        width: '100%', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                >
                    <span>{lang === 'zh' ? '路由推荐参考 — 各任务最佳模型' : 'Routing Reference (Best Model per Task)'}</span>
                    <span style={{ fontSize: '10px' }}>{showRouting ? '▲' : '▼'}</span>
                </button>
                {showRouting && (
                    <div style={{
                        marginTop: '6px', border: '1px solid var(--vscode-input-border)',
                        borderRadius: '4px', overflow: 'hidden',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ background: 'var(--vscode-editor-inactiveSelectionBackground)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {lang === 'zh' ? '任务类型' : 'Task Type'}
                                    </th>
                                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>
                                        {lang === 'zh' ? '推荐模型' : 'Recommended'}
                                    </th>
                                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>
                                        {lang === 'zh' ? '原因' : 'Why'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {([
                                    [lang === 'zh' ? '代码生成' : 'Code Gen', [['DeepSeek', 'V3'], ['Qwen (通义)', 'Coder-Plus']], lang === 'zh' ? '性价比最高；代码专项同级' : 'Best cost-efficiency; code specialist'],
                                    [lang === 'zh' ? '调试 / 重构' : 'Debug', [['Anthropic (Claude)', 'Opus 4.6'], ['OpenAI', 'GPT-5.3 Codex']], lang === 'zh' ? '全球编程最强；Terminal-Bench #1' : 'Best coding; Terminal-Bench #1'],
                                    [lang === 'zh' ? '架构设计' : 'Architecture', [['Anthropic (Claude)', 'Opus 4.6'], ['GLM (智谱)', 'GLM-5']], lang === 'zh' ? '企业级 Agentic；工程接近 Opus' : 'Enterprise Agentic; near Opus'],
                                    [lang === 'zh' ? '文档' : 'Docs', [['Anthropic (Claude)', 'Sonnet 4.6'], ['Qwen (通义)', 'Max']], lang === 'zh' ? '均衡首选；中文文档最强' : 'Balanced; best Chinese docs'],
                                    [lang === 'zh' ? '翻译' : 'Translation', [['Qwen (通义)', 'Max'], ['Mistral', 'Large 3']], lang === 'zh' ? '中文第一；欧洲多语言' : 'Chinese #1; EU multilingual'],
                                    [lang === 'zh' ? 'UI / 前端' : 'UI & Frontend', [['Google (Gemini)', '3.1 Flash'], ['MiniMax', 'M2.5']], lang === 'zh' ? '多模态视觉；100 tok/s' : 'Multimodal; 100 tok/s'],
                                    [lang === 'zh' ? '图像理解' : 'Vision', [['Google (Gemini)', '3.1 Pro'], ['OpenAI', 'GPT-5.1']], lang === 'zh' ? '百万 token 多模态' : 'Million token multimodal'],
                                    [lang === 'zh' ? '长文本' : 'Long Context', [['Google (Gemini)', '3.1 Pro'], ['Kimi K2', 'K2.5']], lang === 'zh' ? '百万上下文；256K MoE' : 'Million ctx; 256K MoE'],
                                    [lang === 'zh' ? '推理' : 'Reasoning', [['DeepSeek', 'R1'], ['Google (Gemini)', '3.1 Pro']], lang === 'zh' ? '思维链顶尖；ARC-AGI-2 #1' : 'CoT top; ARC-AGI-2 #1'],
                                    [lang === 'zh' ? '工具调用' : 'Tool Calling', [['Qwen (通义)', 'Max'], ['OpenAI', 'GPT-5.1']], lang === 'zh' ? 'Tau2-bench #1' : 'Tau2-bench #1'],
                                    [lang === 'zh' ? 'Agentic' : 'Agentic', [['MiniMax', 'M2.5'], ['Anthropic (Claude)', 'Opus 4.6']], lang === 'zh' ? 'SWE-bench 80.2%' : 'SWE-bench 80.2%'],
                                    [lang === 'zh' ? '终端 / DevOps' : 'Terminal', [['OpenAI', 'GPT-5.3 Codex'], ['OpenAI', 'Codex CLI']], lang === 'zh' ? 'Terminal-Bench #1' : 'Terminal-Bench #1'],
                                ] as [string, [string, string][], string][]).map(([task, models, reason], i) => (
                                    <tr key={task} style={{
                                        background: i % 2 === 0 ? 'transparent' : 'var(--vscode-editor-inactiveSelectionBackground)',
                                        borderTop: '1px solid var(--vscode-input-border)',
                                    }}>
                                        <td style={{ padding: '5px 10px', whiteSpace: 'nowrap', fontWeight: 500 }}>{task}</td>
                                        <td style={{ padding: '5px 10px', fontSize: '11px' }}>
                                            {models.map(([prov, name], j) => (
                                                <span key={j}>
                                                    {j > 0 && <span style={{ opacity: 0.4, margin: '0 4px' }}>/</span>}
                                                    <span style={{
                                                        color: providerColors[prov] || 'inherit',
                                                        fontWeight: 600,
                                                    }}>{name}</span>
                                                </span>
                                            ))}
                                        </td>
                                        <td style={{ padding: '5px 10px', fontSize: '11px', opacity: 0.8 }}>{reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{
                            padding: '6px 10px', fontSize: '10px',
                            color: 'var(--vscode-descriptionForeground)',
                            borderTop: '1px solid var(--vscode-input-border)',
                        }}>
                            {lang === 'zh'
                                ? '以上仅为参考，实际路由取决于已配置的模型。L-Hub 支持所有 OpenAI 兼容接口，不限于上表。'
                                : 'These are recommendations only. Actual routing depends on your configured models. L-Hub supports any OpenAI-compatible model.'}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer note */}
            <div style={{
                marginTop: '12px', padding: '10px 14px',
                background: 'var(--vscode-textBlockQuote-background)',
                borderLeft: '3px solid var(--vscode-activityBarBadge-background)',
                borderRadius: '0 4px 4px 0',
                fontSize: '11px', color: 'var(--vscode-descriptionForeground)', lineHeight: '1.6',
            }}>
                {lang === 'zh'
                    ? '路由规则：按任务类型匹配已启用的模型，选优先级最高的（列表靠上）。可随时添加新模型、自定义任务分配。'
                    : 'Routing: L-Hub matches the task type to enabled models and picks the highest-priority one (top of list). You can add any model and customize task assignments.'}
            </div>

            {showModal && (
                <AddEditModal
                    lang={lang} existing={editTarget}
                    onSave={handleSave}
                    onClose={() => { setShowModal(false); setEditTarget(undefined); }}
                />
            )}
        </div>
    );
};

export default ConfigPanel;

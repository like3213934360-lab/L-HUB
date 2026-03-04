// ─── Task Types ──────────────────────────────────────────────────────────────

export const TASK_TYPES = [
    { id: 'code_gen', label_zh: '代码生成', label_en: 'Code Generation' },
    { id: 'code_review', label_zh: '调试 / 重构', label_en: 'Debug & Refactor' },
    { id: 'architecture', label_zh: '架构设计', label_en: 'Architecture' },
    { id: 'documentation', label_zh: '文档 / 注释', label_en: 'Documentation' },
    { id: 'translation', label_zh: '翻译', label_en: 'Translation' },
    { id: 'ui_design', label_zh: 'UI / 前端', label_en: 'UI & Frontend' },
    { id: 'vision', label_zh: '图像理解', label_en: 'Vision' },
    { id: 'long_context', label_zh: '长文本分析', label_en: 'Long Context' },
    { id: 'math_reasoning', label_zh: '数学 / 推理', label_en: 'Math & Reasoning' },
    { id: 'tool_calling', label_zh: '工具调用', label_en: 'Tool Calling' },
    { id: 'creative', label_zh: '创意写作', label_en: 'Creative Writing' },
    { id: 'agentic', label_zh: 'Agentic', label_en: 'Agentic Tasks' },
] as const;

export type TaskId = typeof TASK_TYPES[number]['id'];

// ─── Model Registry ──────────────────────────────────────────────────────────

export interface ModelDefinition {
    label: string;
    providerGroup: string;
    defaultBaseUrl: string;
    defaultTasks: TaskId[];
    note_zh: string;
    note_en: string;
    requiresApiKey: boolean;
    isRelay?: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
    // ── DeepSeek ──────────────────────────────────────────────
    'deepseek-chat': {
        label: 'DeepSeek-V3 (推荐)',
        providerGroup: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        defaultTasks: ['translation', 'documentation'],
        note_zh: '性价比之王（$0.028/M），翻译/文档/体力活首选',
        note_en: 'Best value ($0.028/M), ideal for translation/docs/routine tasks',
        requiresApiKey: true,
    },
    'deepseek-reasoner': {
        label: 'DeepSeek-R1 (推理)',
        providerGroup: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        defaultTasks: ['math_reasoning', 'architecture', 'code_review'],
        note_zh: 'R1 深度推理，思维链分析、数学、规划',
        note_en: 'R1 deep reasoning, chain-of-thought, math, planning',
        requiresApiKey: true,
    },
    // ── GLM (智谱) ────────────────────────────────────────────
    'glm-5': {
        label: 'GLM-5',
        providerGroup: 'GLM (智谱)',
        defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultTasks: ['code_review', 'long_context', 'agentic'],
        note_zh: '复杂工程/调试首选，长文本连贯性前3',
        note_en: 'Complex engineering/debugging, top-3 long-text coherence',
        requiresApiKey: true,
    },
    'glm-5-coding': {
        label: 'GLM-5 (Coding Plan)',
        providerGroup: 'GLM (智谱)',
        defaultBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        defaultTasks: ['code_review', 'agentic', 'long_context'],
        note_zh: 'Coding Plan 包月 · 复杂跨文件工程/调试 · 消耗 2x-3x 套餐配额',
        note_en: 'Coding Plan · complex multi-file engineering · 2x-3x quota',
        requiresApiKey: true,
    },
    'glm-4.7': {
        label: 'GLM-4.7 (Coding Plan 推荐)',
        providerGroup: 'GLM (智谱)',
        defaultBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        defaultTasks: ['code_gen', 'code_review', 'agentic', 'tool_calling'],
        note_zh: 'Coding Plan 日常用，1x 配额消耗，省额度首选',
        note_en: 'Coding Plan daily use, 1x quota, most quota-efficient',
        requiresApiKey: true,
    },
    // ── Qwen (通义) ───────────────────────────────────────────
    'qwen-max': {
        label: 'Qwen-Max (推荐)',
        providerGroup: 'Qwen (通义)',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultTasks: ['translation', 'documentation', 'tool_calling'],
        note_zh: '多语言 + 结构化写作 + 工具调用 Tau2-bench #1',
        note_en: 'Multilingual, structured writing, Tau2-bench #1 tool calls',
        requiresApiKey: true,
    },
    'qwen-coder-plus': {
        label: 'Qwen-Coder-Plus',
        providerGroup: 'Qwen (通义)',
        defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultTasks: ['code_gen', 'code_review', 'agentic'],
        note_zh: '代码专项旗舰，Agentic 编程与工具调用',
        note_en: 'Code specialist, Agentic coding & tool use',
        requiresApiKey: true,
    },
    // ── MiniMax ───────────────────────────────────────────────
    'MiniMax-M2.5': {
        label: 'MiniMax-M2.5 (推荐)',
        providerGroup: 'MiniMax',
        defaultBaseUrl: 'https://api.minimax.io/v1',
        defaultTasks: ['creative', 'agentic', 'long_context'],
        note_zh: '中文文学创作 #1 + 高速生成（100+ tok/s）',
        note_en: 'Chinese creative writing #1, high-speed (100+ tok/s)',
        requiresApiKey: true,
    },
    'MiniMax-M2.5-highspeed': {
        label: 'MiniMax-M2.5 HighSpeed',
        providerGroup: 'MiniMax',
        defaultBaseUrl: 'https://api.minimax.io/v1',
        defaultTasks: ['creative', 'documentation'],
        note_zh: 'M2.5 高速版，去GPT味/文笔打磨，高频调用',
        note_en: 'M2.5 high-speed, writing polish, high-frequency calls',
        requiresApiKey: true,
    },
    // ── Kimi K2 ──────────────────────────────────────────────
    'kimi-k2-instruct': {
        label: 'Kimi K2.5 (推荐)',
        providerGroup: 'Kimi K2',
        defaultBaseUrl: 'https://api.moonshot.cn/v1',
        defaultTasks: ['agentic', 'code_gen', 'tool_calling', 'long_context'],
        note_zh: '最新 K2.5（2026-01），1T MoE，256K 上下文，Agentic 顶尖',
        note_en: 'Latest K2.5, 1T MoE, 256K ctx, top Agentic',
        requiresApiKey: true,
    },
    // ── OpenAI ───────────────────────────────────────────────
    'gpt-5.1': {
        label: 'GPT-5.1 (推荐)',
        providerGroup: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultTasks: ['code_gen', 'vision', 'architecture', 'long_context'],
        note_zh: '最新旗舰，超长上下文，复杂推理与多模态',
        note_en: 'Latest flagship, ultra long context, complex reasoning',
        requiresApiKey: true,
    },
    'gpt-5.3-codex': {
        label: 'GPT-5.3 Codex (编程)',
        providerGroup: 'OpenAI',
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultTasks: ['code_gen', 'code_review', 'agentic'],
        note_zh: '代码生成首选 · Terminal-Bench #1 · 编码优化版',
        note_en: 'Code generation primary · Terminal-Bench #1 · coding-optimized',
        requiresApiKey: true,
    },
    // ── Anthropic (Claude) ───────────────────────────────────
    'claude-opus-4-6': {
        label: 'Claude Opus 4.6 (推荐)',
        providerGroup: 'Anthropic (Claude)',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['architecture', 'agentic', 'code_review', 'long_context'],
        note_zh: '综合质量顶级梯队，架构与 Agentic 优选',
        note_en: 'Top-tier overall quality, architecture & Agentic strong contender',
        requiresApiKey: true,
    },
    'claude-sonnet-4-6': {
        label: 'Claude Sonnet 4.6',
        providerGroup: 'Anthropic (Claude)',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_gen', 'creative', 'architecture', 'documentation'],
        note_zh: '最新（2026-02），性能与成本最佳平衡，通用主力',
        note_en: 'Latest (2026-02), best performance/cost balance',
        requiresApiKey: true,
    },
    'claude-opus-4-5': {
        label: 'Claude Opus 4.5',
        providerGroup: 'Anthropic (Claude)',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_review', 'architecture', 'agentic'],
        note_zh: 'SWE-bench 72.5% 编程顶尖（2025-05）',
        note_en: 'SWE-bench 72.5%, top coding (2025-05)',
        requiresApiKey: true,
    },
    'claude-sonnet-4-5': {
        label: 'Claude Sonnet 4.5',
        providerGroup: 'Anthropic (Claude)',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        defaultTasks: ['code_gen', 'creative', 'documentation'],
        note_zh: '均衡旗舰（2025-05），代码与内容创作首选',
        note_en: 'Balanced flagship (2025-05), code & content creation',
        requiresApiKey: true,
    },
    // ── Google Gemini ────────────────────────────────────────
    'gemini-3.1-flash': {
        label: 'Gemini 3.1 Flash (推荐)',
        providerGroup: 'Google (Gemini)',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['vision', 'code_gen', 'tool_calling', 'long_context'],
        note_zh: '最新 Flash（2026），速度快成本低，多模态全能',
        note_en: 'Latest Flash (2026), fast & cheap, multimodal',
        requiresApiKey: true,
    },
    'gemini-3.1-pro-preview': {
        label: 'Gemini 3.1 Pro Preview',
        providerGroup: 'Google (Gemini)',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['math_reasoning', 'ui_design', 'long_context', 'vision'],
        note_zh: 'ARC-AGI-2 #1（77.1%）· 推理/算法/前端UI 顶级梯队',
        note_en: 'ARC-AGI-2 #1 (77.1%), top-tier reasoning/algo/frontend UI',
        requiresApiKey: true,
    },
    'gemini-3-image': {
        label: 'Gemini Image Gen (生图)',
        providerGroup: 'Google (Gemini)',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultTasks: ['vision', 'creative', 'ui_design'],
        note_zh: '专用图像生成与编辑（Imagen 3 驱动）',
        note_en: 'Image generation & editing (Imagen 3)',
        requiresApiKey: true,
    },
};

// Grouped list for UI dropdowns
export const PROVIDER_GROUPS = [
    'DeepSeek',
    'GLM (智谱)',
    'Qwen (通义)',
    'MiniMax',
    'Kimi K2',
    'OpenAI',
    'Anthropic (Claude)',
    'Google (Gemini)',
];

export function getModelsInGroup(group: string): Array<[string, ModelDefinition]> {
    return Object.entries(MODEL_REGISTRY).filter(([, def]) => def.providerGroup === group);
}


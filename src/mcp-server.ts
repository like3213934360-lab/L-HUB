#!/usr/bin/env node
/**
 * L-Hub Standalone MCP Server
 *
 * Runs as an independent Node.js process via stdio (no vscode dependency).
 * Reads API keys + model config from ~/.l-hub-keys.json (written by VS Code Extension).
 * Supports both v1 (legacy flat key map) and v2 (models array with tasks).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// ── History DB (opened lazily, writes silently suppressed on error) ────────────────
let _historyDb: any = null;
function getHistoryDb(dbPath?: string): any {
    if (_historyDb) { return _historyDb; }
    if (!dbPath || !fs.existsSync(path.dirname(dbPath))) { return null; }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        _historyDb = new Database(dbPath);
        _historyDb.exec(`CREATE TABLE IF NOT EXISTS request_history (
            id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
            client_name TEXT, client_version TEXT, method TEXT NOT NULL,
            tool_name TEXT, model TEXT, duration INTEGER,
            input_tokens INTEGER, output_tokens INTEGER, total_tokens INTEGER,
            request_preview TEXT, response_preview TEXT,
            status TEXT NOT NULL, error_message TEXT
        )`);
        return _historyDb;
    } catch { return null; }
}
function saveHistory(dbPath: string | undefined, rec: {
    model?: string; method: string; toolName?: string;
    duration: number; inputTokens?: number; outputTokens?: number;
    requestPreview: string; responsePreview: string;
    status: 'success' | 'error'; errorMessage?: string;
}) {
    const db = getHistoryDb(dbPath);
    if (!db) { return; }
    try {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(`INSERT OR IGNORE INTO request_history
            (id,timestamp,client_name,method,tool_name,model,duration,input_tokens,output_tokens,total_tokens,request_preview,response_preview,status,error_message)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
            id, Date.now(), 'l-hub-mcp', rec.method, rec.toolName ?? rec.method,
            rec.model ?? null, rec.duration,
            rec.inputTokens ?? null, rec.outputTokens ?? null,
            (rec.inputTokens ?? 0) + (rec.outputTokens ?? 0) || null,
            rec.requestPreview.slice(0, 500), rec.responsePreview.slice(0, 500),
            rec.status, rec.errorMessage ?? null
        );
    } catch { /* never crash the server */ }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const KEYS_FILE = path.join(os.homedir(), '.l-hub-keys.json');

interface ModelConfig {
    id: string;
    modelId: string;
    label: string;
    baseUrl: string;
    tasks: string[];
    enabled: boolean;
    priority: number;
    apiKey?: string;
}

interface LHubConfig {
    version?: number;
    models?: ModelConfig[];
    legacy?: Record<string, string>;
    dbPath?: string;
}

function readConfig(): LHubConfig {
    try {
        if (fs.existsSync(KEYS_FILE)) {
            return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')) as LHubConfig;
        }
    } catch { /* file missing or malformed */ }
    return {};
}

// ─── Legacy fallback (v1 format) ─────────────────────────────────────────────

// ─── L-Hub Routing Philosophy ──────────────────────────────────────────────────
// L-Hub supplements Antigravity (Claude Sonnet 4.6), it does NOT replace it.
// → Do NOT route tasks to Claude here: Claude is already the orchestrator doing
//   complex reasoning, architecture analysis, and long-context work natively.
// → L-Hub's value: specialized models for cost-efficient domain tasks, local
//   CLI tools (Codex, Gemini CLI), and Chinese-ecosystem models.
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_PROVIDERS: Record<string, { url: string; model: string }> = {
    // Code quality tier (2026 SWE-bench ranking)
    glm: { url: 'https://open.bigmodel.cn/api/coding/paas/v4', model: 'glm-5' },  // Agentic coding, matches Claude Sonnet 4.5
    deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },        // Cost-efficient, still strong
    // Specialized
    qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
    minimax: { url: 'https://api.minimax.io/v1', model: 'MiniMax-M2.5-highspeed' },
    kimi: { url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto' }, // k2-instruct 并非全用户开放，使用 v1-auto 兜底
    gpt: { url: 'https://api.openai.com/v1', model: 'gpt-5.3-codex' },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.1-pro-preview' },
    mistral: { url: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
    // NOTE: 'claude' intentionally omitted — Antigravity IS Claude. Routing tasks
    // back to Claude via L-Hub wastes tokens and adds latency with no benefit.
};

// ─── Smart routing ────────────────────────────────────────────────────────────

const TASK_KEYWORDS: Record<string, string[]> = {
    code_gen: ['code', 'write function', 'implement', 'snippet', '代码', '编写', '实现'],
    code_review: ['review', 'debug', 'fix bug', 'refactor', 'lint', '审查', '调试', '重构'],
    architecture: ['architecture', 'design pattern', 'system design', 'diagram', '架构', '设计'],
    documentation: ['document', 'comment', 'readme', 'explain', '注释', '文档'],
    translation: ['translate', 'translation', 'localize', '翻译', '本地化'],
    ui_design: ['ui', 'frontend', 'css', 'component', 'layout', '前端', '组件', '样式'],
    long_context: ['summarize', 'long document', 'file content', '长文本', '总结'],
    math_reasoning: ['math', 'equation', 'calculate', 'proof', 'algorithm', '数学', '计算', '推理'],
    tool_calling: ['function call', 'api integration', 'tool use'],
    creative: ['write story', 'essay', 'creative', '创意', '写作'],
    agentic: ['agent', 'automate', 'autonomous task', '自动化'],
};

function detectTaskType(message: string): string {
    const msg = message.toLowerCase();

    // ── Length-aware routing (takes priority over keywords) ───────────────
    if (message.length > 3000) {
        return 'long_context'; // GLM handles long text best
    }
    if (message.length < 100 && (msg.includes('code') || msg.includes('代码') || msg.includes('function') || msg.includes('函数'))) {
        return 'code_gen'; // DeepSeek for quick short code tasks
    }

    for (const [taskId, keywords] of Object.entries(TASK_KEYWORDS)) {
        if (keywords.some(k => msg.includes(k))) {
            return taskId;
        }
    }
    return 'code_gen'; // safe default
}

interface RouteResult {
    label: string;
    apiKey: string;
    baseUrl: string;
    modelId: string;
}

function resolveRoute(message: string, config: LHubConfig, forcedProvider?: string): RouteResult | null {
    const enabledModels = (config.models || []).filter(m => m.enabled && m.apiKey);

    if (enabledModels.length > 0) {
        // v2: use user's configured models
        let chosen: ModelConfig | undefined;

        if (forcedProvider) {
            // Match by label, modelId, or partial model group name
            const fp = forcedProvider.toLowerCase();
            chosen = enabledModels.find(m =>
                m.modelId.toLowerCase().includes(fp) ||
                m.label.toLowerCase().includes(fp)
            );
        }

        if (!chosen) {
            const taskType = detectTaskType(message);
            const matching = enabledModels
                .filter(m => m.tasks.includes(taskType))
                .sort((a, b) => a.priority - b.priority);
            chosen = matching[0] || enabledModels[0];
        }

        if (!chosen) { return null; }
        return {
            label: chosen.label,
            apiKey: chosen.apiKey!,
            baseUrl: chosen.baseUrl.replace(/\/$/, ''),
            modelId: chosen.modelId,
        };
    }

    // v1 legacy fallback
    const legacy: Record<string, string> = config.legacy || (config as any);
    // Routing philosophy:
    // - Code writing  → gpt (Codex 5.3 API). For file-level code, prefer ai_codex_task (CLI).
    // - Planning/arch → Claude (Antigravity itself — no need to route via L-Hub)
    // - Chinese/docs  → qwen | UI/creative → minimax | Math/algo → gemini
    let providerKey = forcedProvider || 'gpt'; // Codex 5.3 as default code writer

    if (!forcedProvider) {
        const msg = message.toLowerCase();
        if (msg.includes('translate') || msg.includes('翻译') || msg.includes('中文') || msg.includes('documentation') || msg.includes('文档')) { providerKey = 'qwen'; }
        else if (msg.includes('terminal') || msg.includes('devops') || msg.includes('shell') || msg.includes('script')) { providerKey = 'gpt'; }
        else if (msg.includes('math') || msg.includes('数学') || msg.includes('algorithm') || msg.includes('reasoning') || msg.includes('推理')) { providerKey = 'gemini'; }
        else if (msg.includes('ui') || msg.includes('frontend') || msg.includes('design') || msg.includes('前端') || msg.includes('页面') || msg.includes('组件')) { providerKey = 'gemini'; }
        else { providerKey = 'gpt'; } // default: Codex 5.3 for code
    }

    const legacyKey = legacy[providerKey];
    if (!legacyKey) { return null; }

    const prov = LEGACY_PROVIDERS[providerKey];
    if (!prov) { return null; }

    return {
        label: providerKey,
        apiKey: legacyKey,
        baseUrl: prov.url,
        modelId: prov.model,
    };
}

// ─── API Call ─────────────────────────────────────────────────────────────────

async function callProvider(route: RouteResult, message: string, systemPrompt?: string) {
    const url = route.baseUrl.endsWith('/chat/completions')
        ? route.baseUrl
        : `${route.baseUrl}/chat/completions`;

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) { messages.push({ role: 'system', content: systemPrompt }); }
    messages.push({ role: 'user', content: message });

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${route.apiKey}`,
        },
        body: JSON.stringify({ model: route.modelId, messages, temperature: 0.7 }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${route.label} API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as any;
    return {
        text: (data.choices?.[0]?.message?.content as string) || 'No response',
        inputTokens: (data.usage?.prompt_tokens as number) || 0,
        outputTokens: (data.usage?.completion_tokens as number) || 0,
    };
}

// ─── Auto Fallback Retry Chain ───────────────────────────────────────────────

/**
 * Determines if an error is retryable (network issues, rate limits, server errors).
 * Non-retryable: auth errors (401/403), bad requests (400), unknown providers.
 */
function isRetryableError(msg: string): boolean {
    return (
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504')
    );
}

/**
 * Call a provider with automatic fallback to other enabled models on retryable errors.
 * Returns { text, inputTokens, outputTokens, usedModel } where usedModel may differ from route.
 */
async function callProviderWithFallback(
    primaryRoute: RouteResult,
    message: string,
    systemPrompt: string | undefined,
    config: LHubConfig
): Promise<{ text: string; inputTokens: number; outputTokens: number; usedModel: string; didFallback: boolean }> {
    // Build fallback queue: primary first, then other enabled models sorted by priority
    const enabledModels = (config.models || [])
        .filter(m => m.enabled && m.apiKey && m.modelId !== primaryRoute.modelId)
        .sort((a, b) => a.priority - b.priority);

    const fallbackRoutes: RouteResult[] = enabledModels.slice(0, 3).map(m => ({
        label: m.label,
        apiKey: m.apiKey!,
        baseUrl: m.baseUrl.replace(/\/$/, ''),
        modelId: m.modelId,
    }));

    const attemptQueue = [primaryRoute, ...fallbackRoutes];
    const errors: string[] = [];

    for (let i = 0; i < attemptQueue.length; i++) {
        const route = attemptQueue[i];
        try {
            const result = await callProvider(route, message, systemPrompt);
            return {
                ...result,
                usedModel: route.modelId,
                didFallback: i > 0,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`[${route.label}] ${msg}`);

            // Only retry on retryable errors
            if (!isRetryableError(msg)) {
                // Non-retryable: bail immediately
                throw new Error(msg);
            }
            // else: continue to next model in queue
        }
    }

    // All models failed
    throw new Error(`All models failed:\n${errors.join('\n')}`);
}

// ─── File Context Injection ───────────────────────────────────────────────────

const MAX_FILE_BYTES = 200 * 1024;      // 200 KB per file
const MAX_TOTAL_BYTES = 1024 * 1024;    // 1 MB total

/**
 * Reads a list of file paths and formats their contents as a context block
 * to be prepended to the system prompt.
 */
function buildFileContext(filePaths: string[]): { context: string; warnings: string[] } {
    const sections: string[] = [];
    const warnings: string[] = [];
    let totalBytes = 0;

    const homeDir = os.homedir();

    for (const rawPath of filePaths) {
        try {
            // Resolve path (support ~ expansion and relative to home)
            const absPath = rawPath.startsWith('~')
                ? path.join(homeDir, rawPath.slice(1))
                : path.resolve(rawPath);

            // Security: basic traversal sanity (no ../../ tricks after resolve)
            const normalized = path.normalize(absPath);

            if (!fs.existsSync(normalized)) {
                warnings.push(`File not found: ${rawPath}`);
                continue;
            }

            const stat = fs.statSync(normalized);
            if (!stat.isFile()) {
                warnings.push(`Not a file: ${rawPath}`);
                continue;
            }
            if (stat.size > MAX_FILE_BYTES) {
                warnings.push(`Skipped (too large, >${MAX_FILE_BYTES / 1024}KB): ${rawPath}`);
                continue;
            }

            totalBytes += stat.size;
            if (totalBytes > MAX_TOTAL_BYTES) {
                warnings.push(`Stopped reading files: total size limit (${MAX_TOTAL_BYTES / 1024}KB) exceeded`);
                break;
            }

            const content = fs.readFileSync(normalized, 'utf8');
            const displayName = path.basename(normalized);

            sections.push(`=== FILE: ${displayName} ===\n${content.trimEnd()}\n=== END FILE ===`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            warnings.push(`Error reading ${rawPath}: ${msg}`);
        }
    }

    return {
        context: sections.length > 0
            ? `The following file(s) have been provided as context:\n\n${sections.join('\n\n')}`
            : '',
        warnings,
    };
}

// ─── Codex CLI ────────────────────────────────────────────────────────────────

/**
 * 异步调用 Codex CLI。使用 spawn（非 spawnSync）避免阻塞 Node.js 事件循环，
 * 确保 MCP Server 在 CLI 执行期间仍能响应 Antigravity 的心跳和其他请求。
 *
 * 四层超时策略：
 * ① 不活跃超时（3 分钟）：进程已死且无输出 → 立即终止
 * ② 进程心跳（60 秒）：kill(0) 探测存活性，存活则抑制不活跃超时
 * ③ 无真实数据超时（10 分钟）：进程虽活但无任何 stdout/stderr → 判定卡死
 *    （独立于心跳，kill(0) 无法欺骗此计时器，只有真实数据才能重置）
 * ④ 绝对上限（30 分钟）：无条件终止（安全网）
 */
async function callCodex(task: string, workingDir?: string): Promise<string> {
    const cwd = workingDir || process.cwd();
    const INACTIVITY_MS = 180_000;      // ① 3 分钟：进程死亡 + 无输出 → 超时
    const HEARTBEAT_MS = 60_000;        // ② 每 60 秒检测进程存活
    const NO_DATA_MS = 600_000;         // ③ 10 分钟无真实数据 → 超时（心跳无法重置）
    const ABSOLUTE_MAX_MS = 1_800_000;  // ④ 30 分钟绝对上限

    return new Promise<string>((resolve, reject) => {
        const child = spawn(
            'codex',
            ['exec', '--skip-git-repo-check', '--full-auto', task],
            { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } }
        );

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let settled = false;
        let processAlive = true; // 心跳维护的存活状态

        function cleanup() {
            clearTimeout(inactivityTimer);
            clearTimeout(noDataTimer);
            clearTimeout(absoluteTimer);
            clearInterval(heartbeat);
        }
        function settle(fn: () => void) {
            if (settled) return;
            settled = true;
            cleanup();
            fn();
        }

        // ——— ① 不活跃超时（进程死亡 + 无输出 → 终止）———
        // 只由真实数据重置。心跳不重置此计时器，但如果进程还活着则抑制触发。
        let inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_MS);
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            if (!settled) {
                inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_MS);
            }
        }
        function onInactivityTimeout() {
            if (settled) return;
            if (processAlive) {
                // 进程还活着，只是短暂没输出，不触发超时，重新计时
                resetInactivityTimer();
                return;
            }
            // 进程已死且 3 分钟无输出 → 真的卡了
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Codex CLI timed out: process dead and no output for ${INACTIVITY_MS / 1000}s`));
            });
        }

        // ——— ② 进程心跳（只维护 processAlive 状态，不重置任何计时器）———
        const heartbeat = setInterval(() => {
            if (settled) { clearInterval(heartbeat); return; }
            try {
                child.kill(0);
                processAlive = true;
            } catch {
                processAlive = false;
                clearInterval(heartbeat);
            }
        }, HEARTBEAT_MS);

        // ——— ③ 无真实数据超时（独立于心跳，只有真实 stdout/stderr 才能重置）———
        let noDataTimer = setTimeout(onNoDataTimeout, NO_DATA_MS);
        function resetNoDataTimer() {
            clearTimeout(noDataTimer);
            if (!settled) {
                noDataTimer = setTimeout(onNoDataTimeout, NO_DATA_MS);
            }
        }
        function onNoDataTimeout() {
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Codex CLI timed out: no real output for ${NO_DATA_MS / 60000}min (process may be stuck despite being alive)`));
            });
        }

        // ——— ④ 绝对上限 ———
        const absoluteTimer = setTimeout(() => {
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Codex CLI reached absolute time limit (${ABSOLUTE_MAX_MS / 60000}min)`));
            });
        }, ABSOLUTE_MAX_MS);

        // ——— 数据事件：同时重置 ① 和 ③ ———
        child.stdout.on('data', (chunk: Buffer) => {
            stdoutChunks.push(chunk);
            resetInactivityTimer();
            resetNoDataTimer();
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
            resetInactivityTimer();
            resetNoDataTimer();
        });

        child.on('error', (err: NodeJS.ErrnoException) => {
            settle(() => {
                if (err.code === 'ENOENT') {
                    reject(new Error('Codex CLI not found. Install: npm install -g @openai/codex, then: codex login'));
                } else {
                    reject(new Error(`Codex CLI error: ${err.message}`));
                }
            });
        });

        child.on('close', (code: number | null) => {
            settle(() => {
                const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
                const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || `Codex exited with code ${code}`));
                } else {
                    resolve(stdout || '(Codex completed with no output)');
                }
            });
        });
    });
}

// ─── Gemini CLI ───────────────────────────────────────────────────────────────

/**
 * 异步调用 Gemini CLI。使用 spawn（非 spawnSync）避免阻塞 Node.js 事件循环。
 * 自动去除 ANSI 转义码。
 *
 * 四层超时策略（与 callCodex 对称）：
 * ① 不活跃超时（3 分钟）：进程已死且无输出 → 立即终止
 * ② 进程心跳（60 秒）：kill(0) 探测存活性，存活则抑制不活跃超时
 * ③ 无真实数据超时（10 分钟）：进程虽活但无任何 stdout/stderr → 判定卡死
 *    （独立于心跳，kill(0) 无法欺骗此计时器，只有真实数据才能重置）
 * ④ 绝对上限（30 分钟）：无条件终止（安全网）
 */
async function callGemini(prompt: string, model?: string, workingDir?: string): Promise<string> {
    const cwd = workingDir || process.cwd();
    const INACTIVITY_MS = 180_000;      // ① 3 分钟：进程死亡 + 无输出 → 超时
    const HEARTBEAT_MS = 60_000;        // ② 每 60 秒检测进程存活
    const NO_DATA_MS = 600_000;         // ③ 10 分钟无真实数据 → 超时（心跳无法重置）
    const ABSOLUTE_MAX_MS = 1_800_000;  // ④ 30 分钟绝对上限

    // Build args: use -p (short for --prompt) + --yolo to auto-accept any tool confirmations
    const cliArgs: string[] = ['-p', prompt, '--yolo'];
    if (model) { cliArgs.push('-m', model); }

    return new Promise<string>((resolve, reject) => {
        const child = spawn('gemini', cliArgs, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let settled = false;
        let processAlive = true;

        function cleanup() {
            clearTimeout(inactivityTimer);
            clearTimeout(noDataTimer);
            clearTimeout(absoluteTimer);
            clearInterval(heartbeat);
        }
        function settle(fn: () => void) {
            if (settled) return;
            settled = true;
            cleanup();
            fn();
        }

        // ——— ① 不活跃超时 ———
        let inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_MS);
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            if (!settled) {
                inactivityTimer = setTimeout(onInactivityTimeout, INACTIVITY_MS);
            }
        }
        function onInactivityTimeout() {
            if (settled) return;
            if (processAlive) {
                resetInactivityTimer();
                return;
            }
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Gemini CLI timed out: process dead and no output for ${INACTIVITY_MS / 1000}s`));
            });
        }

        // ——— ② 进程心跳 ———
        const heartbeat = setInterval(() => {
            if (settled) { clearInterval(heartbeat); return; }
            try {
                child.kill(0);
                processAlive = true;
            } catch {
                processAlive = false;
                clearInterval(heartbeat);
            }
        }, HEARTBEAT_MS);

        // ——— ③ 无真实数据超时 ———
        let noDataTimer = setTimeout(onNoDataTimeout, NO_DATA_MS);
        function resetNoDataTimer() {
            clearTimeout(noDataTimer);
            if (!settled) {
                noDataTimer = setTimeout(onNoDataTimeout, NO_DATA_MS);
            }
        }
        function onNoDataTimeout() {
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Gemini CLI timed out: no real output for ${NO_DATA_MS / 60000}min (process may be stuck despite being alive)`));
            });
        }

        // ——— ④ 绝对上限 ———
        const absoluteTimer = setTimeout(() => {
            settle(() => {
                child.kill('SIGTERM');
                reject(new Error(`Gemini CLI reached absolute time limit (${ABSOLUTE_MAX_MS / 60000}min)`));
            });
        }, ABSOLUTE_MAX_MS);

        // ——— 数据事件：同时重置 ① 和 ③ ———
        child.stdout.on('data', (chunk: Buffer) => {
            stdoutChunks.push(chunk);
            resetInactivityTimer();
            resetNoDataTimer();
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
            resetInactivityTimer();
            resetNoDataTimer();
        });

        child.on('error', (err: NodeJS.ErrnoException) => {
            settle(() => {
                if (err.code === 'ENOENT') {
                    reject(new Error('Gemini CLI not found. Install: https://github.com/google-gemini/gemini-cli — then run `gemini` to log in.'));
                } else {
                    reject(new Error(`Gemini CLI error: ${err.message}`));
                }
            });
        });

        child.on('close', (code: number | null) => {
            settle(() => {
                const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
                const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

                // Gemini CLI may write to stderr for progress; non-zero exit on hard error
                if (code !== 0 && !stdout) {
                    reject(new Error(stderr || `Gemini CLI exited with code ${code}`));
                    return;
                }

                // Strip ANSI escape codes (colors, cursor movement, etc.)
                // eslint-disable-next-line no-control-regex
                const clean = stdout.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B[@-_]/g, '');
                resolve(clean || '(Gemini completed with no output)');
            });
        });
    });
}



// ─── MCP Server ───────────────────────────────────────────────────────────────

async function main() {
    const server = new Server(
        { name: 'lhub', version: '0.2.1' },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: 'ai_ask',
                description: 'Ask a question to a specialized AI expert. L-Hub auto-routes to the best model based on your configured models and task types. Specify a provider to force a specific one.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The question or task.' },
                        provider: { type: 'string', description: 'Force a specific provider (e.g. "deepseek", "glm"). Omit for smart auto-routing.' },
                        system_prompt: { type: 'string', description: 'Optional system-level instructions.' },
                        file_paths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional local file paths whose contents will be injected as context (max 200KB each, 1MB total). Supports absolute paths and ~ expansion.',
                        },
                    },
                    required: ['message'],
                },
            },
            {
                name: 'ai_list_providers',
                description: 'List configured AI models and their assigned task types.',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'ai_codex_task',
                description: 'Run an autonomous coding task using Codex CLI. Codex reads/writes local files and executes terminal commands — no API key needed, uses your ChatGPT account. Best for: file rewrites, code review, refactoring.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        task: { type: 'string', description: 'Task description for Codex.' },
                        working_dir: { type: 'string', description: 'Working directory. Defaults to current directory.' },
                    },
                    required: ['task'],
                },
            },
            {
                name: 'ai_gemini_task',
                description: 'Run an autonomous task using the local Gemini CLI (Google Gemini). Gemini has deep file/tool access via its built-in tools. Best for: reasoning tasks, code generation, file analysis, multi-step agentic workflows. Requires Gemini CLI installed (`npm i -g @google/gemini-cli`).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'The prompt / task to send to Gemini.' },
                        model: { type: 'string', description: 'Optional Gemini model to use (e.g. "gemini-2.5-pro"). Defaults to CLI default.' },
                        working_dir: { type: 'string', description: 'Working directory for Gemini CLI. Defaults to current directory.' },
                    },
                    required: ['prompt'],
                },
            },
            {
                name: 'ai_multi_ask',
                description: 'Ask multiple AI models the same question in parallel and compare their responses. Best for getting diverse perspectives, cross-validating answers, or finding the best response.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The question or task to send to all models.' },
                        providers: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of provider names to query in parallel (e.g. ["deepseek", "glm", "qwen"]). Omit to use all enabled models.',
                        },
                        system_prompt: { type: 'string', description: 'Optional system-level instructions for all models.' },
                        file_paths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional local file paths whose contents will be injected as context.',
                        },
                    },
                    required: ['message'],
                },
            },
            {
                name: 'ai_consensus',
                description: 'Multi-model voting engine. Asks multiple models the same question, then uses a judge model to score and select the best answer based on preset criteria. Returns the winning answer with scores and reasoning.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The question or task to send to all models.' },
                        criteria: { type: 'string', description: 'Judging criteria: "code_quality", "creativity", "accuracy", "completeness", or custom description. Defaults to "accuracy".' },
                        providers: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of provider names to query. Omit to use all enabled models.',
                        },
                        judge: { type: 'string', description: 'Provider to use as judge. Omit to auto-select the strongest available model.' },
                        system_prompt: { type: 'string', description: 'Optional system-level instructions for candidate models.' },
                        file_paths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional local file paths for context.',
                        },
                    },
                    required: ['message'],
                },
            },
        ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const config = readConfig();

        // ── ai_list_providers ─────────────────────────────────────────────
        if (request.params.name === 'ai_list_providers') {
            const enabledModels = (config.models || []).filter(m => m.enabled && m.apiKey);

            const codexCheck = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000 });
            const codexStatus = codexCheck.error
                ? '❌ Not installed (run: npm install -g @openai/codex)'
                : `✅ Installed (${(codexCheck.stdout || '').trim() || 'uses ChatGPT login'})`;

            const geminiCheck = spawnSync('gemini', ['--version'], { encoding: 'utf8', timeout: 5000 });
            let geminiStatus = '❌ Not installed (npm i -g @google/gemini-cli)';
            if (!geminiCheck.error && geminiCheck.status === 0) {
                // gemini-cli version string can sometimes have ANSI or multiline
                const out = (geminiCheck.stdout || '').split('\n')[0].replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B[@-_]/g, '').trim();
                geminiStatus = `✅ Installed (Auto local credentials)`;
            }

            if (enabledModels.length > 0) {
                const lines = enabledModels.map(m =>
                    `✅ ${m.label} (${m.modelId}) — tasks: ${m.tasks.join(', ') || 'none'}`
                );
                return {
                    content: [{ type: 'text', text: `Configured models:\n${lines.join('\n')}\n\n🤖 Codex CLI: ${codexStatus}\n🔷 Gemini CLI: ${geminiStatus}` }],
                };
            }

            // v1 fallback
            const legacy: Record<string, string> = config.legacy || (config as any);
            const configured = Object.keys(LEGACY_PROVIDERS).filter(p => !!legacy[p]);
            const missing = Object.keys(LEGACY_PROVIDERS).filter(p => !legacy[p]);
            return {
                content: [{
                    type: 'text',
                    text: `✅ Configured: ${configured.join(', ') || 'none'}\n❌ Missing key: ${missing.join(', ') || 'none'}\n🤖 Codex CLI: ${codexStatus}\n🔷 Gemini CLI: ${geminiStatus}\n\nTip: Open L-Hub Dashboard (Cmd+Shift+P → "L-Hub: Open Dashboard") to manage models.`,
                }],
            };
        }

        // ── ai_codex_task ─────────────────────────────────────────────────
        if (request.params.name === 'ai_codex_task') {
            const args = request.params.arguments as { task: string; working_dir?: string };
            if (!args?.task) {
                return { content: [{ type: 'text', text: 'Error: task is required' }], isError: true };
            }
            const t0 = Date.now();
            try {
                const result = await callCodex(args.task, args.working_dir);
                saveHistory(config.dbPath, {
                    method: 'ai_codex_task', model: 'codex-cli',
                    duration: Date.now() - t0,
                    requestPreview: args.task, responsePreview: result,
                    status: 'success',
                });
                return { content: [{ type: 'text', text: result }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                saveHistory(config.dbPath, {
                    method: 'ai_codex_task', model: 'codex-cli',
                    duration: Date.now() - t0,
                    requestPreview: args.task, responsePreview: msg,
                    status: 'error', errorMessage: msg,
                });
                return { content: [{ type: 'text', text: `Codex error: ${msg}` }], isError: true };
            }
        }

        // ── ai_gemini_task ────────────────────────────────────────────────
        if (request.params.name === 'ai_gemini_task') {
            const args = request.params.arguments as { prompt: string; model?: string; working_dir?: string };
            if (!args?.prompt) {
                return { content: [{ type: 'text', text: 'Error: prompt is required' }], isError: true };
            }
            const t0 = Date.now();
            try {
                const result = await callGemini(args.prompt, args.model, args.working_dir);
                saveHistory(config.dbPath, {
                    method: 'ai_gemini_task', model: args.model || 'gemini-cli',
                    duration: Date.now() - t0,
                    requestPreview: args.prompt, responsePreview: result,
                    status: 'success',
                });
                return { content: [{ type: 'text', text: result }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                saveHistory((config as any).dbPath, {
                    method: 'ai_gemini_task', model: args.model || 'gemini-cli',
                    duration: Date.now() - t0,
                    requestPreview: args.prompt, responsePreview: msg,
                    status: 'error', errorMessage: msg,
                });
                return { content: [{ type: 'text', text: `Gemini CLI error: ${msg}` }], isError: true };
            }
        }

        // ── ai_ask ────────────────────────────────────────────────────────
        if (request.params.name === 'ai_ask') {
            const args = request.params.arguments as {
                message: string;
                provider?: string;
                system_prompt?: string;
                file_paths?: string[];
            };
            if (!args?.message) {
                return { content: [{ type: 'text', text: 'Error: message is required' }], isError: true };
            }

            // Build system prompt with file context if provided
            let systemPrompt = args.system_prompt;
            const warningLines: string[] = [];
            if (args.file_paths && args.file_paths.length > 0) {
                const { context, warnings } = buildFileContext(args.file_paths);
                warningLines.push(...warnings);
                if (context) {
                    systemPrompt = systemPrompt ? `${systemPrompt}\n\n${context}` : context;
                }
            }

            const route = resolveRoute(args.message, config, args.provider);
            if (!route) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ No configured model found${args.provider ? ` for provider "${args.provider}"` : ''}.\\n\\nPlease open L-Hub Dashboard (Cmd+Shift+P → "L-Hub: Open Dashboard") and add a model with an API key.`,
                    }],
                    isError: true,
                };
            }

            const t0 = Date.now();
            try {
                const result = await callProviderWithFallback(route, args.message, systemPrompt, config);
                const fallbackNote = result.didFallback
                    ? `\n\n---\n⚡ *Auto-fallback: responded by **${result.usedModel}** (primary model unavailable)*`
                    : '';
                const warningNote = warningLines.length > 0
                    ? `\n\n> ⚠️ File context warnings: ${warningLines.join('; ')}`
                    : '';
                saveHistory(config.dbPath, {
                    method: 'ai_ask', model: result.usedModel,
                    duration: Date.now() - t0,
                    inputTokens: result.inputTokens, outputTokens: result.outputTokens,
                    requestPreview: args.message, responsePreview: result.text,
                    status: 'success',
                });
                return { content: [{ type: 'text', text: result.text + fallbackNote + warningNote }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                saveHistory(config.dbPath, {
                    method: 'ai_ask', model: route.modelId,
                    duration: Date.now() - t0,
                    requestPreview: args.message, responsePreview: msg,
                    status: 'error', errorMessage: msg,
                });
                return { content: [{ type: 'text', text: `Error calling ${route.label}: ${msg}` }], isError: true };
            }
        }

        // ── ai_multi_ask ──────────────────────────────────────────────────
        if (request.params.name === 'ai_multi_ask') {
            const args = request.params.arguments as {
                message: string;
                providers?: string[];
                system_prompt?: string;
                file_paths?: string[];
            };
            if (!args?.message) {
                return { content: [{ type: 'text', text: 'Error: message is required' }], isError: true };
            }

            // Build system prompt with file context if provided
            let systemPrompt = args.system_prompt;
            const warningLines: string[] = [];
            if (args.file_paths && args.file_paths.length > 0) {
                const { context, warnings } = buildFileContext(args.file_paths);
                warningLines.push(...warnings);
                if (context) {
                    systemPrompt = systemPrompt ? `${systemPrompt}\n\n${context}` : context;
                }
            }

            // Determine which providers to query
            const enabledModels = (config.models || []).filter(m => m.enabled && m.apiKey);
            let providerList: string[];
            if (args.providers && args.providers.length > 0) {
                providerList = args.providers;
            } else if (enabledModels.length > 0) {
                // Use all enabled models (up to 5 to avoid overload)
                providerList = enabledModels.slice(0, 5).map(m => m.id);
            } else {
                providerList = ['deepseek', 'glm', 'qwen'];
            }

            const dbPath = (config as any).dbPath;

            // Run all in parallel
            const t0 = Date.now();
            const tasks = providerList.map(async (provider) => {
                const route = resolveRoute(args.message, config, provider);
                if (!route) return { provider, error: `No config for "${provider}"` };
                const ts = Date.now();
                try {
                    const result = await callProvider(route, args.message, systemPrompt);
                    saveHistory(dbPath, {
                        method: 'ai_multi_ask', model: route.modelId,
                        duration: Date.now() - ts,
                        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
                        requestPreview: args.message, responsePreview: result.text,
                        status: 'success',
                    });
                    return { provider: route.label, text: result.text, duration: Date.now() - ts, tokens: (result.inputTokens || 0) + (result.outputTokens || 0) };
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    saveHistory(dbPath, {
                        method: 'ai_multi_ask', model: route.modelId,
                        duration: Date.now() - ts,
                        requestPreview: args.message, responsePreview: msg,
                        status: 'error', errorMessage: msg,
                    });
                    return { provider: route.label, error: msg };
                }
            });

            const results = await Promise.allSettled(tasks);
            const totalMs = Date.now() - t0;

            // Format comparison output
            const sections: string[] = [`🔀 **ai_multi_ask** — ${providerList.length} models | ${totalMs}ms total\n`];
            if (warningLines.length > 0) {
                sections.push(`> ⚠️ File context warnings: ${warningLines.join('; ')}\n`);
            }
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    const v = r.value;
                    if (v.error) {
                        sections.push(`---\n### ❌ ${v.provider}\n${v.error}`);
                    } else {
                        sections.push(`---\n### ✅ ${v.provider} (${v.duration}ms | ${v.tokens} tokens)\n${v.text}`);
                    }
                } else {
                    sections.push(`---\n### ❌ Error\n${r.reason}`);
                }
            }

            return { content: [{ type: 'text', text: sections.join('\n') }] };
        }

        // ── ai_consensus ─────────────────────────────────────────────────
        if (request.params.name === 'ai_consensus') {
            const args = request.params.arguments as {
                message: string;
                criteria?: string;
                providers?: string[];
                judge?: string;
                system_prompt?: string;
                file_paths?: string[];
            };
            if (!args?.message) {
                return { content: [{ type: 'text', text: 'Error: message is required' }], isError: true };
            }

            const criteria = args.criteria || 'accuracy';

            // Build system prompt with file context
            let systemPrompt = args.system_prompt;
            if (args.file_paths && args.file_paths.length > 0) {
                const { context } = buildFileContext(args.file_paths);
                if (context) {
                    systemPrompt = systemPrompt ? `${systemPrompt}\n\n${context}` : context;
                }
            }

            // Step 1: Get candidate responses (reuse ai_multi_ask logic)
            const enabledModels = (config.models || []).filter(m => m.enabled && m.apiKey);
            let providerList: string[];
            if (args.providers && args.providers.length > 0) {
                providerList = args.providers;
            } else if (enabledModels.length > 0) {
                providerList = enabledModels.slice(0, 5).map(m => m.id);
            } else {
                providerList = ['deepseek', 'glm', 'qwen'];
            }

            const dbPath = (config as any).dbPath;
            const t0 = Date.now();

            const tasks = providerList.map(async (provider) => {
                const route = resolveRoute(args.message, config, provider);
                if (!route) return { provider, label: provider, error: `No config for "${provider}"` };
                const ts = Date.now();
                try {
                    const result = await callProvider(route, args.message, systemPrompt);
                    return { provider, label: route.label, text: result.text, duration: Date.now() - ts };
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    return { provider, label: route.label, error: msg };
                }
            });

            const rawResults = await Promise.allSettled(tasks);
            const candidates: Array<{ label: string; text: string }> = [];
            for (const r of rawResults) {
                if (r.status === 'fulfilled' && r.value.text) {
                    candidates.push({ label: r.value.label, text: r.value.text });
                }
            }

            if (candidates.length === 0) {
                return { content: [{ type: 'text', text: 'Error: all candidate models failed to respond.' }], isError: true };
            }

            if (candidates.length === 1) {
                // Only one candidate, no need to judge
                return { content: [{ type: 'text', text: `🏆 **ai_consensus** — Only 1 candidate responded\n\n**Winner: ${candidates[0].label}**\n\n${candidates[0].text}` }] };
            }

            // Step 2: Ask judge model to evaluate
            const judgeProvider = args.judge || providerList[0];
            const judgeRoute = resolveRoute('', config, judgeProvider);
            if (!judgeRoute) {
                // Fallback: just return all candidates
                const fallback = candidates.map((c, i) => `### Candidate ${i + 1}: ${c.label}\n${c.text}`).join('\n\n---\n\n');
                return { content: [{ type: 'text', text: `🔀 **ai_consensus** — Judge unavailable, showing all candidates\n\n${fallback}` }] };
            }

            const candidateBlock = candidates.map((c, i) => `=== Candidate ${i + 1} (${c.label}) ===\n${c.text}`).join('\n\n');

            const judgePrompt = `You are an expert judge. Evaluate the following ${candidates.length} candidate answers to the user's question.

User's Question: ${args.message}

Judging Criteria: ${criteria}

${candidateBlock}

=== Your Task ===
1. Score each candidate from 1-10 based on the criteria "${criteria}"
2. Explain your reasoning for each score in 1-2 sentences
3. Declare the winner
4. Output the winning answer in full

Format your response as:
SCORES:
- Candidate 1 (name): X/10 — reason
- Candidate 2 (name): X/10 — reason
...

WINNER: Candidate N (name)

BEST ANSWER:
[full winning answer here]`;

            try {
                const judgeResult = await callProvider(judgeRoute, judgePrompt);
                const totalMs = Date.now() - t0;

                saveHistory(dbPath, {
                    method: 'ai_consensus', model: judgeRoute.modelId,
                    duration: totalMs,
                    inputTokens: judgeResult.inputTokens, outputTokens: judgeResult.outputTokens,
                    requestPreview: args.message, responsePreview: judgeResult.text.slice(0, 200),
                    status: 'success',
                });

                return { content: [{ type: 'text', text: `🏆 **ai_consensus** — ${candidates.length} candidates | Judge: ${judgeRoute.label} | ${totalMs}ms\nCriteria: **${criteria}**\n\n${judgeResult.text}` }] };
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                const fallback = candidates.map((c, i) => `### Candidate ${i + 1}: ${c.label}\n${c.text}`).join('\n\n---\n\n');
                return { content: [{ type: 'text', text: `⚠️ **ai_consensus** — Judge failed (${msg}), showing all candidates\n\n${fallback}` }] };
            }
        }

        return {
            content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
            isError: true,
        };
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`L-Hub MCP server fatal error: ${msg}\n`);
    process.exit(1);
});

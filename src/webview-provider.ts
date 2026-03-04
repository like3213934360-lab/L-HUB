import * as vscode from 'vscode';
import * as path from 'path';
import { HistoryStorage } from './storage';
import { SettingsManager } from './settings';

export class DashboardPanel {
    public static currentPanel: DashboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _onConfigChanged?: () => void;
    /** Cache model test results so Overview panel can display them across tab switches */
    private _modelTestCache: Map<string, 'online' | 'offline'> = new Map();

    public static createOrShow(extensionUri: vscode.Uri, storage: HistoryStorage, settings: SettingsManager, onConfigChanged?: () => void) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardPanel.currentPanel) {
            DashboardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'lhubDashboard',
            'L-Hub',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'images'),
                ],
                retainContextWhenHidden: true
            }
        );

        DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, storage, settings, onConfigChanged);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private storage: HistoryStorage, private settings: SettingsManager, onConfigChanged?: () => void) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._onConfigChanged = onConfigChanged;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    // ── Legacy key management ─────────────────────────────────
                    case 'getApiKeys': {
                        const keys = await this.settings.getAllApiKeys();
                        this._panel.webview.postMessage({ command: 'loadApiKeys', data: keys });
                        break;
                    }
                    case 'saveApiKey': {
                        if (message.provider && message.key !== undefined) {
                            await this.settings.saveApiKey(message.provider, message.key);
                        }
                        break;
                    }

                    // ── v2 Model management ───────────────────────────────────
                    case 'getModelsV2': {
                        const models = await this.settings.getModels();
                        // collect per-model API keys
                        const apiKeys: Record<string, string> = {};
                        for (const m of models) {
                            const k = await this.settings.getApiKey(`model.${m.id}`);
                            if (k) { apiKeys[m.id] = k; }
                        }
                        this._panel.webview.postMessage({ command: 'loadModelsV2', models, apiKeys });
                        break;
                    }
                    case 'addModel': {
                        const { modelConfig, apiKey } = message;
                        await this.settings.addModel(modelConfig);
                        if (apiKey) {
                            await this.settings.saveApiKey(`model.${modelConfig.id}`, apiKey);
                        }
                        await this._syncModelsToFile();
                        // Re-send updated list
                        const models = await this.settings.getModels();
                        const apiKeys: Record<string, string> = {};
                        for (const m of models) {
                            const k = await this.settings.getApiKey(`model.${m.id}`);
                            if (k) { apiKeys[m.id] = k; }
                        }
                        this._panel.webview.postMessage({ command: 'loadModelsV2', models, apiKeys });
                        this._onConfigChanged?.();
                        break;
                    }
                    case 'removeModel': {
                        await this.settings.removeModel(message.id);
                        await this._syncModelsToFile();
                        const models = await this.settings.getModels();
                        const apiKeys: Record<string, string> = {};
                        for (const m of models) {
                            const k = await this.settings.getApiKey(`model.${m.id}`);
                            if (k) { apiKeys[m.id] = k; }
                        }
                        this._panel.webview.postMessage({ command: 'loadModelsV2', models, apiKeys });
                        this._onConfigChanged?.();
                        break;
                    }
                    case 'updateModel': {
                        await this.settings.updateModel(message.id, message.patch);
                        if (message.apiKey !== undefined) {
                            await this.settings.saveApiKey(`model.${message.id}`, message.apiKey);
                        }
                        await this._syncModelsToFile();
                        const models = await this.settings.getModels();
                        const apiKeys: Record<string, string> = {};
                        for (const m of models) {
                            const k = await this.settings.getApiKey(`model.${m.id}`);
                            if (k) { apiKeys[m.id] = k; }
                        }
                        this._panel.webview.postMessage({ command: 'loadModelsV2', models, apiKeys });
                        this._onConfigChanged?.();
                        break;
                    }
                    // ── Backend-proxied connection test (bypasses CORS) ───────
                    case 'testConnection': {
                        const { modelId, baseUrl, apiKey, requestId } = message;
                        try {
                            const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
                            const body = JSON.stringify({
                                model: modelId,
                                messages: [{ role: 'user', content: 'Say OK' }],
                                max_tokens: 5,
                            });
                            const res = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                                body,
                                signal: AbortSignal.timeout(15000),
                            });
                            const json = await res.json() as any;
                            if (res.ok) {
                                this._panel.webview.postMessage({ command: 'testResult', requestId, ok: true, msg: '已连通' });
                            } else {
                                const err = json?.error?.message || json?.message || json?.msg || `HTTP ${res.status}`;
                                this._panel.webview.postMessage({ command: 'testResult', requestId, ok: false, msg: (err as string).substring(0, 70) });
                            }
                        } catch (e: any) {
                            const msg = e.message?.includes('timeout') ? '超时 15s' : (e.message || 'Error').substring(0, 60);
                            this._panel.webview.postMessage({ command: 'testResult', requestId, ok: false, msg });
                        }
                        break;
                    }


                    case 'getHistory': {
                        const page = message.page || 1;
                        const pageSize = message.pageSize || 50;
                        const data = this.storage.queryHistory(page, pageSize);
                        this._panel.webview.postMessage({ command: 'loadHistory', data });
                        break;
                    }

                    // ── Open external URL ─────────────────────────────────────
                    case 'openUrl': {
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                        break;
                    }
                    // ── Copy to clipboard ─────────────────────────────────────
                    case 'copyToClipboard': {
                        vscode.env.clipboard.writeText(message.text || '');
                        break;
                    }
                    // ── Generate diagnostics report ──────────────────────────
                    case 'generateDiagnostics': {
                        const models = await this.settings.getModels();
                        const enabledCount = models.filter((m: any) => m.enabled).length;
                        const { spawnSync } = require('child_process');
                        const codexVer = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 3000, shell: true });
                        const geminiVer = spawnSync('gemini', ['--version'], { encoding: 'utf8', timeout: 3000, shell: true });
                        const report = [
                            '## L-Hub 诊断报告',
                            `- 时间: ${new Date().toISOString()}`,
                            `- L-Hub 版本: 0.2.0`,
                            `- 已配置模型: ${models.length} 个（${enabledCount} 个已启用）`,
                            `- Codex CLI: ${codexVer.error ? '未安装' : (codexVer.stdout || '').trim()}`,
                            `- Gemini CLI: ${geminiVer.error ? '未安装' : (geminiVer.stdout || '').trim()}`,
                            '',
                            '### 模型配置',
                            ...models.map((m: any) => `- ${m.id}: ${m.enabled ? '✅ 启用' : '❌ 禁用'} | Key: ${m.apiKey ? '已配' : '未配'}`),
                        ].join('\n');
                        vscode.env.clipboard.writeText(report);
                        vscode.window.showInformationMessage('诊断报告已复制到剪贴板，可粘贴到 GitHub Issue');
                        break;
                    }
                    // ── Codex CLI status ──────────────────────────────────────
                    case 'getCodexStatus': {
                        const { spawnSync } = require('child_process');
                        const ver = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 5000, shell: true });
                        if (ver.error) {
                            this._panel.webview.postMessage({ command: 'codexStatus', installed: false, loggedIn: false });
                            break;
                        }
                        // Try a lightweight env check to see if login token exists
                        const envCheck = spawnSync('codex', ['--help'], { encoding: 'utf8', timeout: 5000, shell: true });
                        const version = (ver.stdout || '').trim();
                        this._panel.webview.postMessage({ command: 'codexStatus', installed: true, version, loggedIn: envCheck.status === 0 });
                        break;
                    }
                    // ── Gemini CLI status ─────────────────────────────────────
                    case 'getGeminiStatus': {
                        const { spawnSync: spawnSync2 } = require('child_process');
                        const gVer = spawnSync2('gemini', ['--version'], { encoding: 'utf8', timeout: 5000, shell: true });
                        if (gVer.error) {
                            this._panel.webview.postMessage({ command: 'geminiStatus', installed: false, loggedIn: false });
                            break;
                        }
                        const gVersion = (gVer.stdout || '').trim();
                        // Check if logged in by looking for oauth_creds.json
                        const os = require('os');
                        const credPath = require('path').join(os.homedir(), '.gemini', 'oauth_creds.json');
                        const loggedIn = require('fs').existsSync(credPath);
                        this._panel.webview.postMessage({ command: 'geminiStatus', installed: true, version: gVersion, loggedIn });
                        break;
                    }
                    // ── Open terminal with command ────────────────────────────
                    case 'openTerminalWithCmd': {
                        const terminal = vscode.window.createTerminal('L-Hub Setup');
                        terminal.show();
                        terminal.sendText(message.cmd);
                        break;
                    }

                    // ── Overview Stats ────────────────────────────────────────
                    case 'getOverviewStats': {
                        const allModels = await this.settings.getModels();
                        const modelStatuses = [];
                        for (const m of allModels) {
                            const key = await this.settings.getApiKey(`model.${m.id}`);
                            modelStatuses.push({
                                id: m.id,
                                label: m.label || m.modelId,
                                modelId: m.modelId,
                                group: (m as any).group || '',
                                enabled: m.enabled !== false,
                                status: this._modelTestCache.get(m.id) || (key ? 'unknown' : 'offline'),
                                testMsg: key ? undefined : 'No API Key',
                            });
                        }

                        // Get history stats
                        let todayRequests = 0;
                        let successCount = 0;
                        let totalLatency = 0;
                        let totalTokens = 0;
                        const recentRequests: any[] = [];
                        try {
                            if (!this.storage) { throw new Error('storage not initialized'); }
                            const data = this.storage.queryHistory(1, 50);
                            const records = data?.records || [];
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            const todayTs = todayStart.getTime();

                            for (const r of records) {
                                if (r.timestamp >= todayTs) {
                                    todayRequests++;
                                    if (r.status === 'success') successCount++;
                                    totalLatency += r.duration || 0;
                                    totalTokens += r.totalTokens || 0;
                                }
                            }
                            // Take recent 8 for timeline
                            for (const r of records.slice(0, 8)) {
                                recentRequests.push({
                                    id: r.id,
                                    timestamp: r.timestamp,
                                    method: r.method,
                                    model: r.model || '',
                                    duration: r.duration || 0,
                                    status: r.status,
                                    totalTokens: r.totalTokens || 0,
                                });
                            }
                        } catch (e) {
                            // History storage might not be available
                        }

                        const successRate = todayRequests > 0 ? Math.round((successCount / todayRequests) * 100) : 100;
                        const avgLatency = todayRequests > 0 ? Math.round(totalLatency / todayRequests) : 0;

                        // Check CLI statuses
                        const { spawnSync: ss } = require('child_process');
                        const codexVer = ss('codex', ['--version'], { encoding: 'utf8', timeout: 3000, shell: true });
                        const geminiVer = ss('gemini', ['--version'], { encoding: 'utf8', timeout: 3000, shell: true });
                        const gCredPath = require('path').join(require('os').homedir(), '.gemini', 'oauth_creds.json');

                        const cliStatuses = [
                            {
                                id: 'codex-cli', label: 'Codex CLI',
                                modelId: 'codex-cli', group: 'cli', enabled: true,
                                status: codexVer.error ? 'offline' : 'online',
                                testMsg: codexVer.error ? '未安装' : `v${(codexVer.stdout || '').trim()}`,
                            },
                            {
                                id: 'gemini-cli', label: 'Gemini CLI',
                                modelId: 'gemini-cli', group: 'cli', enabled: true,
                                status: geminiVer.error ? 'offline' : 'online',
                                testMsg: geminiVer.error ? '未安装' : (require('fs').existsSync(gCredPath) ? `v${(geminiVer.stdout || '').trim()} · 已登录` : `v${(geminiVer.stdout || '').trim()} · 未登录`),
                            },
                        ];

                        this._panel.webview.postMessage({
                            command: 'overviewStats',
                            stats: {
                                models: [...modelStatuses, ...cliStatuses],
                                todayRequests,
                                successRate,
                                avgLatency,
                                totalTokens,
                                recentRequests,
                            }
                        });
                        break;
                    }

                    // ── Test All Models ───────────────────────────────────────
                    case 'testAllModels': {
                        const models2 = await this.settings.getModels();
                        const enabledModels = models2.filter(m => m.enabled !== false);
                        // Stagger requests with 1.5s delay to avoid 429 rate limits
                        for (let i = 0; i < enabledModels.length; i++) {
                            const m = enabledModels[i];
                            if (i > 0) await new Promise(r => setTimeout(r, 1500));
                            const key = await this.settings.getApiKey(`model.${m.id}`);
                            if (!key || !m.baseUrl) continue;
                            const requestId = `autotest_${m.id}_${Date.now()}`;
                            try {
                                const url = m.baseUrl.replace(/\/$/, '') + '/chat/completions';
                                const res = await fetch(url, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
                                    body: JSON.stringify({ model: m.modelId, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
                                    signal: AbortSignal.timeout(15000),
                                });
                                const json = await res.json() as any;
                                if (res.ok) {
                                    this._modelTestCache.set(m.id, 'online');
                                    this._panel.webview.postMessage({ command: 'testResult', requestId, ok: true, msg: '已连通' });
                                } else {
                                    this._modelTestCache.set(m.id, 'offline');
                                    const err = json?.error?.message || json?.message || `HTTP ${res.status}`;
                                    this._panel.webview.postMessage({ command: 'testResult', requestId, ok: false, msg: (err as string).substring(0, 70) });
                                }
                            } catch (e: any) {
                                this._modelTestCache.set(m.id, 'offline');
                                const msg = e.message?.includes('timeout') ? '超时 15s' : (e.message || 'Error').substring(0, 60);
                                this._panel.webview.postMessage({ command: 'testResult', requestId, ok: false, msg });
                            }
                        }
                        this._panel.webview.postMessage({ command: 'testAllComplete' });
                        break;
                    }
                }
            },
            null,
            this._disposables
        );
    }

    /** Sync full model config (with API keys) to ~/.l-hub-keys.json */
    private async _syncModelsToFile() {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const keysFile = path.join(os.homedir(), '.l-hub-keys.json');
        try {
            const models = await this.settings.getModels();
            const enriched = [];
            for (const m of models) {
                const k = await this.settings.getApiKey(`model.${m.id}`);
                enriched.push({ ...m, apiKey: k || '' });
            }
            // Also keep legacy keys for backward compat
            const legacy = await this.settings.getAllApiKeys();
            fs.writeFileSync(keysFile, JSON.stringify({ version: 2, models: enriched, legacy, dbPath: this.storage.getDbPath() }, null, 2), 'utf8');
        } catch (e) {
            console.error('[L-Hub] Failed to sync models to file:', e);
        }
    }

    public dispose() {
        DashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const logoPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'images', 'logo.png');
        const logoUri = webview.asWebviewUri(logoPathOnDisk);

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; connect-src https: wss:;">
                <title>L-Hub</title>
                <style>
                    body {
                        padding: 0;
                        margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                    }
                    #root {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    /* ── Animations ─────────────────────────────────── */
                    @keyframes pulse-glow {
                        0%, 100% { box-shadow: 0 0 4px currentColor; opacity: 1; }
                        50% { box-shadow: 0 0 12px currentColor, 0 0 24px currentColor; opacity: 0.85; }
                    }
                    @keyframes gradient-shift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(12px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes shimmer {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                    }
                    @keyframes breathe {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                    .animate-in { animation: fade-in-up 0.4s ease-out both; }
                    .animate-in-1 { animation-delay: 0.05s; }
                    .animate-in-2 { animation-delay: 0.1s; }
                    .animate-in-3 { animation-delay: 0.15s; }
                    .animate-in-4 { animation-delay: 0.2s; }
                    .dot-online {
                        animation: pulse-glow 2s ease-in-out infinite;
                        color: #34A853;
                    }
                    .gradient-bg {
                        background-size: 200% 200%;
                        animation: gradient-shift 6s ease infinite;
                    }
                    .shimmer-bar {
                        background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%);
                        background-size: 200% 100%;
                        animation: shimmer 2s ease-in-out infinite;
                    }
                    /* ── Scrollbar ──────────────────────────────────── */
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
                    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                </style>
            </head>
            <body>
                <div id="root" data-logo-uri="${logoUri}"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

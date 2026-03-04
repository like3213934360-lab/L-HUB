import * as vscode from 'vscode';

export interface BridgeConfig {
    defaultModel: string;
    retentionDays: number;
}

// Legacy fixed providers (for backward compat)
export const SUPPORTED_PROVIDERS = ['deepseek', 'glm', 'qwen', 'minimax', 'kimi', 'gpt', 'gemini', 'mistral'] as const;
export type Provider = typeof SUPPORTED_PROVIDERS[number];

// ─── v2: Dynamic ModelConfig ─────────────────────────────────────────────────

export interface ModelConfig {
    id: string;           // UUID
    modelId: string;      // key in MODEL_REGISTRY, e.g. "deepseek-chat"
    label: string;        // display label
    baseUrl: string;      // API base URL
    tasks: string[];      // assigned task IDs
    enabled: boolean;
    priority: number;     // lower = higher priority among same-task models
}

export class SettingsManager {
    private secretStorage: vscode.SecretStorage;
    private static readonly MODELS_KEY = 'l-hub.models.v2';

    constructor(context: vscode.ExtensionContext) {
        this.secretStorage = context.secrets;
    }

    // ── Legacy API key methods (still used for mcp-server.js sync) ───────────
    public async saveApiKey(provider: string, apiKey: string): Promise<void> {
        await this.secretStorage.store(`apikey.${provider}`, apiKey);
    }

    public async getApiKey(provider: string): Promise<string | undefined> {
        return await this.secretStorage.get(`apikey.${provider}`);
    }

    public async getAllApiKeys(): Promise<Record<string, string>> {
        const keys: Record<string, string> = {};
        for (const provider of SUPPORTED_PROVIDERS) {
            const key = await this.getApiKey(provider);
            if (key) { keys[provider] = key; }
        }
        return keys;
    }

    /** Get the API key for a v2 model by its model config ID */
    public async getModelApiKey(modelConfigId: string): Promise<string | undefined> {
        return await this.secretStorage.get(`apikey.model.${modelConfigId}`);
    }

    // ── v2: ModelConfig list ─────────────────────────────────────────────────

    public async getModels(): Promise<ModelConfig[]> {
        const raw = await this.secretStorage.get(SettingsManager.MODELS_KEY);
        if (!raw) { return this.getDefaultModels(); }
        try {
            const models = JSON.parse(raw) as ModelConfig[];
            // ── Auto-migrate stale base URLs & model IDs ──────────────────────
            const URL_MIGRATIONS: [string, string][] = [
                ['https://api.minimaxi.com/v1', 'https://api.minimax.io/v1'],
                ['https://api.minimax.chat/v1', 'https://api.minimax.io/v1'],
                ['https://api.minimaxi.io/v1', 'https://api.minimax.io/v1'], // hybrid-typo
            ];
            const MODEL_ID_MIGRATIONS: [string, string][] = [
                ['minimax-text-2.5', 'MiniMax-M2.5'],
                ['minimax-text-01', 'MiniMax-M2.5'],
            ];
            let dirty = false;
            for (const m of models) {
                for (const [from, to] of URL_MIGRATIONS) {
                    if (m.baseUrl === from) { m.baseUrl = to; dirty = true; }
                }
                for (const [from, to] of MODEL_ID_MIGRATIONS) {
                    if (m.modelId === from) { m.modelId = to; dirty = true; }
                }
            }
            if (dirty) { await this.saveModels(models); }
            return models;
        }
        catch { return this.getDefaultModels(); }
    }

    public async saveModels(models: ModelConfig[]): Promise<void> {
        await this.secretStorage.store(SettingsManager.MODELS_KEY, JSON.stringify(models));
    }

    public async addModel(model: ModelConfig): Promise<void> {
        const models = await this.getModels();
        models.push(model);
        await this.saveModels(models);
    }

    public async updateModel(id: string, patch: Partial<ModelConfig>): Promise<void> {
        const models = await this.getModels();
        const idx = models.findIndex(m => m.id === id);
        if (idx !== -1) { models[idx] = { ...models[idx], ...patch }; }
        await this.saveModels(models);
    }

    public async removeModel(id: string): Promise<void> {
        const models = await this.getModels();
        await this.saveModels(models.filter(m => m.id !== id));
    }

    // ── Default starter models ──────────────────────────────────────────────

    private getDefaultModels(): ModelConfig[] {
        // v0.2.0: New users start with an empty model list.
        // They add models themselves via Dashboard → "+ 添加模型".
        // Existing users who already have models in secretStorage are NOT affected.
        // Codex CLI and Gemini CLI are detected separately and shown at the bottom.
        return [];
    }

    // ── General config ───────────────────────────────────────────────────────
    public getGeneralConfig(): BridgeConfig {
        const config = vscode.workspace.getConfiguration('l-hub');
        return {
            defaultModel: config.get<string>('defaultModel', 'deepseek'),
            retentionDays: config.get<number>('retentionDays', 30),
        };
    }
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { WebSocketServer } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HistoryStorage } from './storage';
import { SettingsManager, Provider } from './settings';

class WsTransport implements Transport {
    public onclose?: () => void;
    public onerror?: (error: Error) => void;
    public onmessage?: (message: JSONRPCMessage) => void;

    constructor(private ws: import('ws').WebSocket) {
        ws.on('message', (message: Buffer) => {
            try {
                const reqStr = message.toString('utf8');
                const req = JSON.parse(reqStr);
                this.onmessage?.(req);
            } catch (e) {
                console.error('WsTransport parse error:', e);
            }
        });
        ws.on('close', () => this.onclose?.());
        ws.on('error', (err: Error) => this.onerror?.(err));
    }

    async start() {}

    async close() {
        this.ws.close();
    }

    async send(message: JSONRPCMessage) {
        this.ws.send(JSON.stringify(message) + '\n');
    }
}

export class LinglanMcpServer {
    private httpServer: http.Server;
    private wss: WebSocketServer;
    private portFile = path.join(os.homedir(), '.l-hub.port');

    constructor(
        private storage: HistoryStorage,
        private settings: SettingsManager
    ) {
        this.httpServer = http.createServer();
        this.wss = new WebSocketServer({ server: this.httpServer });

        this.wss.on('connection', (ws) => {
            const transport = new WsTransport(ws);
            const mcpServer = new Server({
                name: "l-hub",
                version: "0.0.1"
            }, {
                capabilities: {
                    tools: {}
                }
            });

            // Set up lists
            mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
                return {
                    tools: [
                        {
                            name: "ai_ask",
                            description: "Ask a single question to an AI provider. Route complex architecture queries to GLM, general coding to DeepSeek, translation to Qwen, UI/design to MiniMax.",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    provider: {
                                        type: "string",
                                        enum: ["deepseek", "glm", "qwen", "minimax"],
                                        description: "The AI provider to use. If omitted, the default route is used."
                                    },
                                    message: {
                                        type: "string",
                                        description: "The question or prompt for the AI."
                                    },
                                    system_prompt: {
                                        type: "string",
                                        description: "Optional system instructions."
                                    }
                                },
                                required: ["message"]
                            }
                        }
                    ]
                };
            });

            mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
                const reqStr = JSON.stringify(request);
                const startTime = Date.now();
                let resultText = '';
                let errorMsg = '';
                let status: 'success' | 'error' = 'success';
                let usedModel = 'unknown';
                let inputTokens = 0;
                let outputTokens = 0;

                try {
                    if (request.params.name === "ai_ask") {
                        const args = request.params.arguments as { provider?: string, message: string, system_prompt?: string };
                        let provider = args.provider as Provider || this.settings.getGeneralConfig().defaultModel as Provider;
                        usedModel = provider;

                        // Smart Routing Heuristics
                        if (!args.provider) {
                            const msg = args.message.toLowerCase();
                            if (msg.includes('architecture') || msg.includes('架构') || msg.includes('design pattern')) {
                                provider = 'glm';
                                usedModel = 'glm (auto-routed)';
                            } else if (msg.includes('translate') || msg.includes('翻译')) {
                                provider = 'qwen';
                                usedModel = 'qwen (auto-routed)';
                            } else if (msg.includes('ui') || msg.includes('frontend') || msg.includes('前端')) {
                                provider = 'minimax';
                                usedModel = 'minimax (auto-routed)';
                            } else {
                                provider = 'deepseek';
                                usedModel = 'deepseek (default)';
                            }
                        }

                        const apiKey = await this.settings.getApiKey(provider);
                        if (!apiKey) {
                            throw new Error(`API Key for ${provider} is not configured.`);
                        }

                        const apiResponse = await this.callAIProvider(provider, apiKey, args.message, args.system_prompt);
                        resultText = apiResponse.text;
                        inputTokens = apiResponse.inputTokens;
                        outputTokens = apiResponse.outputTokens;

                        const response = {
                            content: [{ type: "text", text: resultText }],
                            isError: false
                        };

                        this.logTransaction(request.params.name, usedModel, startTime, reqStr, JSON.stringify(response), 'success', inputTokens, outputTokens);
                        return response;
                    }
                    throw new Error(`Unknown tool: ${request.params.name}`);
                } catch (e: any) {
                    status = 'error';
                    errorMsg = e.message;
                    resultText = `Error: ${e.message}`;
                    this.logTransaction(request.params.name, usedModel, startTime, reqStr, resultText, 'error', 0, 0, e.message);
                    return {
                        content: [{ type: "text", text: resultText }],
                        isError: true
                    };
                }
            });

            mcpServer.connect(transport);
        });
    }

    private logTransaction(toolName: string, model: string, startTime: number, reqStr: string, resStr: string, status: 'success' | 'error', inputTokens: number, outputTokens: number, errorMsg?: string) {
        this.storage.saveRecord({
            id: Date.now().toString(),
            timestamp: startTime,
            clientName: 'VS Code Client',
            clientVersion: '1.0',
            method: 'tools/call',
            toolName: toolName,
            model: model,
            duration: Date.now() - startTime,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            requestPreview: reqStr.substring(0, 1000),
            responsePreview: resStr.substring(0, 1000),
            status,
            errorMessage: errorMsg
        });
    }

    private async callAIProvider(provider: Provider, apiKey: string, message: string, systemPrompt?: string) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: message });

        let url = '';
        let model = '';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        if (provider === 'deepseek') {
            url = 'https://api.deepseek.com/v1/chat/completions';
            model = 'deepseek-chat';
        } else if (provider === 'glm') {
            url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
            model = 'glm-4';
        } else if (provider === 'qwen') {
            url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            model = 'qwen-max';
        } else if (provider === 'minimax') {
            url = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
            model = 'abab6.5-chat'; // Based on MiniMax standard api
        }

        const body = JSON.stringify({
            model,
            messages,
            temperature: 0.7
        });

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body
        });

        if (!res.ok) {
            const errStr = await res.text();
            throw new Error(`API error from ${provider}: ${res.status} ${errStr}`);
        }

        const data = await res.json() as any;
        return {
            text: data.choices?.[0]?.message?.content || 'No response',
            inputTokens: data.usage?.prompt_tokens || 0,
            outputTokens: data.usage?.completion_tokens || 0
        };
    }

    public async start() {
        return new Promise<void>((resolve) => {
            this.httpServer.listen(0, '127.0.0.1', () => {
                const addr = this.httpServer.address();
                if (addr && typeof addr !== 'string') {
                    fs.writeFileSync(this.portFile, addr.port.toString(), 'utf8');
                    console.log(`L-Hub MCP running on port ${addr.port}`);
                }
                resolve();
            });
        });
    }

    public stop() {
        if (fs.existsSync(this.portFile)) {
            fs.unlinkSync(this.portFile);
        }
        this.wss.close();
        this.httpServer.close();
    }
}

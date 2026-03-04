import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

export interface RequestRecord {
    id: string;
    timestamp: number;
    clientName: string;
    clientVersion: string;
    method: string;
    toolName?: string;
    model?: string;
    duration: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    requestPreview: string;
    responsePreview: string;
    status: 'success' | 'error';
    errorMessage?: string;
}

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS request_history (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    client_name TEXT,
    client_version TEXT,
    method TEXT NOT NULL,
    tool_name TEXT,
    model TEXT,
    duration INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    request_preview TEXT,
    response_preview TEXT,
    status TEXT NOT NULL,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_timestamp ON request_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_client ON request_history(client_name);
CREATE INDEX IF NOT EXISTS idx_model ON request_history(model);`;

/**
 * HistoryStorage — reads from the shared SQLite database.
 * 
 * Supports two modes:
 * 1. Native mode (better-sqlite3) — fast, synchronous, preferred
 * 2. CLI fallback mode (sqlite3 CLI) — works when native module ABI doesn't match
 *    the host Electron version (common in VS Code / Antigravity extensions)
 * 
 * The MCP server process (pure Node.js) writes records via its own better-sqlite3.
 * The extension host (Electron) reads via whichever mode works.
 */
export class HistoryStorage {
    private db: any = null;
    private dbPathStr: string;
    private useCliFallback = false;

    constructor(storagePath: string) {
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
        const dbPath = path.join(storagePath, 'history.db');
        this.dbPathStr = dbPath;

        // Try native module first
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const Database = require('better-sqlite3');
            this.db = new Database(dbPath);
            this.db.exec(CREATE_TABLE_SQL);
            console.log('[L-Hub] HistoryStorage: using native better-sqlite3 ✅');
        } catch (nativeErr: any) {
            console.warn('[L-Hub] HistoryStorage: better-sqlite3 native load failed:', nativeErr.message);
            // Check if sqlite3 CLI is available as fallback
            try {
                execSync('sqlite3 --version', { timeout: 3000, encoding: 'utf8' });
                this.useCliFallback = true;
                // Ensure table exists via CLI
                this._execCli(CREATE_TABLE_SQL);
                console.log('[L-Hub] HistoryStorage: using sqlite3 CLI fallback ✅');
            } catch {
                throw new Error('Neither better-sqlite3 native module nor sqlite3 CLI is available');
            }
        }
    }

    public getDbPath(): string {
        return this.dbPathStr;
    }

    // ── CLI fallback helpers ──────────────────────────────────────────────────

    private _execCli(sql: string): string {
        try {
            return execSync(`sqlite3 "${this.dbPathStr}" "${sql.replace(/"/g, '\\"')}"`, {
                timeout: 5000,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024,
            }).trim();
        } catch {
            return '';
        }
    }

    private _queryCliJson(sql: string): any[] {
        try {
            const result = execSync(
                `sqlite3 -json "${this.dbPathStr}" "${sql.replace(/"/g, '\\"')}"`,
                { timeout: 5000, encoding: 'utf8', maxBuffer: 1024 * 1024 }
            ).trim();
            if (!result) { return []; }
            return JSON.parse(result);
        } catch {
            return [];
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public saveRecord(record: RequestRecord) {
        if (this.useCliFallback) {
            // CLI write (rarely needed since MCP server handles writes)
            const sql = `INSERT OR IGNORE INTO request_history (id,timestamp,client_name,client_version,method,tool_name,model,duration,input_tokens,output_tokens,total_tokens,request_preview,response_preview,status,error_message) VALUES ('${record.id}',${record.timestamp},'${record.clientName || ''}','${record.clientVersion || ''}','${record.method}','${record.toolName || ''}','${record.model || ''}',${record.duration},${record.inputTokens || 0},${record.outputTokens || 0},${record.totalTokens || 0},'${(record.requestPreview || '').replace(/'/g, "''")}','${(record.responsePreview || '').replace(/'/g, "''")}','${record.status}','${(record.errorMessage || '').replace(/'/g, "''")}');`;
            this._execCli(sql);
            return;
        }
        try {
            const stmt = this.db.prepare(`
                INSERT INTO request_history (
                    id, timestamp, client_name, client_version, method, tool_name, model,
                    duration, input_tokens, output_tokens, total_tokens, request_preview,
                    response_preview, status, error_message
                ) VALUES (
                    @id, @timestamp, @clientName, @clientVersion, @method, @toolName, @model,
                    @duration, @inputTokens, @outputTokens, @totalTokens, @requestPreview,
                    @responsePreview, @status, @errorMessage
                )
            `);
            stmt.run(record);
        } catch (error) {
            console.error('Failed to save history record:', error);
        }
    }

    public queryHistory(page: number, pageSize: number): { records: RequestRecord[], total: number } {
        const offset = (page - 1) * pageSize;

        if (this.useCliFallback) {
            const rows = this._queryCliJson(
                `SELECT * FROM request_history ORDER BY timestamp DESC LIMIT ${pageSize} OFFSET ${offset}`
            );
            const countRows = this._queryCliJson(
                `SELECT COUNT(*) as count FROM request_history`
            );
            return {
                records: rows.map(this.mapDbRowToRecord),
                total: countRows[0]?.count || 0,
            };
        }

        const records = this.db.prepare('SELECT * FROM request_history ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(pageSize, offset);
        const total = this.db.prepare('SELECT COUNT(*) as count FROM request_history').get() as { count: number };

        return {
            records: records.map(this.mapDbRowToRecord),
            total: total.count
        };
    }

    public cleanupOldRecords(daysToKeep: number = 30) {
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        if (this.useCliFallback) {
            this._execCli(`DELETE FROM request_history WHERE timestamp < ${cutoff}`);
            return;
        }
        this.db.prepare('DELETE FROM request_history WHERE timestamp < ?').run(cutoff);
    }

    public clearAll() {
        if (this.useCliFallback) {
            this._execCli('DELETE FROM request_history');
            return;
        }
        this.db.exec('DELETE FROM request_history');
    }

    public close() {
        if (this.db) { this.db.close(); }
    }

    private mapDbRowToRecord(row: any): RequestRecord {
        return {
            id: row.id,
            timestamp: row.timestamp,
            clientName: row.client_name,
            clientVersion: row.client_version,
            method: row.method,
            toolName: row.tool_name,
            model: row.model,
            duration: row.duration,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            totalTokens: row.total_tokens,
            requestPreview: row.request_preview,
            responsePreview: row.response_preview,
            status: row.status,
            errorMessage: row.error_message
        };
    }
}

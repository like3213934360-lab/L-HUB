#!/usr/bin/env node
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const portFile = path.join(os.homedir(), '.l-hub.port');
if (!fs.existsSync(portFile)) {
    console.error('L-Hub Extension is not running in VS Code.');
    process.exit(1);
}

const port = fs.readFileSync(portFile, 'utf8').trim();
const ws = new WebSocket(`ws://127.0.0.1:${port}`);

ws.on('open', () => {
    process.stdin.on('data', (data) => {
        ws.send(data);
    });
});

ws.on('message', (data) => {
    process.stdout.write(data as Buffer);
});

ws.on('close', () => {
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    process.exit(1);
});

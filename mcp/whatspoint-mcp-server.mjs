#!/usr/bin/env node

const serverInfo = {
    name: 'whatspoint-mcp',
    version: '0.1.0'
};

const tools = [
    {
        name: 'getTenantInfo',
        description: 'Retourne le tenant WhatsPoint associé à la clé API courante.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'listEmployees',
        description: 'Liste les collaborateurs actifs du tenant, sans exposer les numéros complets.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    minimum: 1,
                    maximum: 200
                }
            },
            additionalProperties: false
        }
    },
    {
        name: 'listAttendanceSummary',
        description: 'Retourne une synthèse des pointages sur une période courte, sans coordonnées GPS brutes.',
        inputSchema: {
            type: 'object',
            properties: {
                from: {
                    type: 'string',
                    format: 'date-time'
                },
                to: {
                    type: 'string',
                    format: 'date-time'
                }
            },
            additionalProperties: false
        }
    }
];

const apiBaseUrl = (process.env.WHATSPOINT_API_BASE_URL || 'https://api.testbed.whatspoint.com').replace(/\/+$/, '');
const apiKey = process.env.WHATSPOINT_API_KEY;
let buffer = Buffer.alloc(0);

function sendMessage(message) {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function sendResult(id, result) {
    sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
    sendMessage({
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            ...(data === undefined ? {} : { data })
        }
    });
}

async function callWhatsPoint(path) {
    if (!apiKey) {
        throw new Error('WHATSPOINT_API_KEY is required.');
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`
        }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
        const message = body?.error?.message || `WhatsPoint API returned HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.body = body;
        throw error;
    }

    return body;
}

function contentResponse(data) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(data, null, 2)
            }
        ]
    };
}

async function handleToolCall(params = {}) {
    const args = params.arguments || {};

    if (params.name === 'getTenantInfo') {
        return contentResponse(await callWhatsPoint('/api/v1/me'));
    }

    if (params.name === 'listEmployees') {
        const limit = Number.isFinite(Number(args.limit)) ? Math.min(Math.max(Number(args.limit), 1), 200) : 50;
        return contentResponse(await callWhatsPoint(`/api/v1/employees?limit=${Math.floor(limit)}`));
    }

    if (params.name === 'listAttendanceSummary') {
        const query = new URLSearchParams();
        if (typeof args.from === 'string') query.set('from', args.from);
        if (typeof args.to === 'string') query.set('to', args.to);
        const suffix = query.size > 0 ? `?${query.toString()}` : '';
        return contentResponse(await callWhatsPoint(`/api/v1/attendance/summary${suffix}`));
    }

    throw new Error(`Unknown tool: ${params.name}`);
}

async function handleMessage(message) {
    if (!message || typeof message.method !== 'string') {
        sendError(message?.id ?? null, -32600, 'Invalid request.');
        return;
    }

    if (message.method.startsWith('notifications/')) {
        return;
    }

    try {
        if (message.method === 'initialize') {
            sendResult(message.id, {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo
            });
            return;
        }

        if (message.method === 'tools/list') {
            sendResult(message.id, { tools });
            return;
        }

        if (message.method === 'tools/call') {
            sendResult(message.id, await handleToolCall(message.params));
            return;
        }

        sendError(message.id, -32601, `Method not found: ${message.method}`);
    } catch (error) {
        sendError(message.id, -32603, error instanceof Error ? error.message : 'Internal error.', {
            status: error?.status,
            body: error?.body
        });
    }
}

function consumeFramedMessages() {
    while (buffer.length > 0) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            return;
        }

        const header = buffer.subarray(0, headerEnd).toString('utf8');
        const match = header.match(/content-length:\s*(\d+)/i);
        if (!match) {
            buffer = Buffer.alloc(0);
            return;
        }

        const length = Number(match[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + length;
        if (buffer.length < bodyEnd) {
            return;
        }

        const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
        buffer = buffer.subarray(bodyEnd);
        void handleMessage(JSON.parse(body));
    }
}

process.stdin.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    consumeFramedMessages();
});

process.stdin.resume();

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const serverPath = path.resolve(__dirname, '../../mcp/whatspoint-mcp-server.mjs');
let child: ChildProcessWithoutNullStreams | null = null;

function frame(message: unknown): string {
    const body = JSON.stringify(message);
    return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function parseFrames(output: Buffer): Array<any> {
    const messages: Array<any> = [];
    let cursor = 0;

    while (cursor < output.byteLength) {
        const headerEnd = output.indexOf('\r\n\r\n', cursor, 'utf8');
        if (headerEnd === -1) break;

        const header = output.subarray(cursor, headerEnd).toString('utf8');
        const match = header.match(/content-length:\s*(\d+)/i);
        if (!match) break;

        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + Number(match[1]);
        if (output.byteLength < bodyEnd) break;

        messages.push(JSON.parse(output.subarray(bodyStart, bodyEnd).toString('utf8')));
        cursor = bodyEnd;
    }

    return messages;
}

function startServer(): ChildProcessWithoutNullStreams {
    child = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            WHATSPOINT_API_BASE_URL: 'https://api.testbed.whatspoint.com',
            WHATSPOINT_API_KEY: 'wp_test_unit_fake'
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    return child;
}

async function exchange(requests: unknown[], expectedCount: number): Promise<any[]> {
    const proc = startServer();
    let output = Buffer.alloc(0);

    proc.stdout.on('data', chunk => {
        output = Buffer.concat([output, chunk]);
    });

    for (const request of requests) {
        proc.stdin.write(frame(request));
    }

    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
        const messages = parseFrames(output);
        if (messages.length >= expectedCount) {
            return messages;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    throw new Error(`Expected ${expectedCount} MCP responses, got ${parseFrames(output).length}`);
}

afterEach(() => {
    child?.kill();
    child = null;
});

describe('whatspoint MCP server', () => {
    it('lists read tools and the protected sendEmployeeMessage action', async () => {
        const responses = await exchange([
            { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }
        ], 1);

        expect(responses[0].result.tools.map((tool: { name: string }) => tool.name)).toEqual([
            'getTenantInfo',
            'listEmployees',
            'listAttendanceSummary',
            'sendEmployeeMessage'
        ]);
        expect(responses[0].result.tools.find((tool: { name: string }) => tool.name === 'sendEmployeeMessage').inputSchema.required).toEqual([
            'employeeId',
            'message',
            'idempotencyKey'
        ]);
    });

    it('rejects sendEmployeeMessage before calling the API when idempotency is missing', async () => {
        const responses = await exchange([
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'sendEmployeeMessage',
                    arguments: {
                        employeeId: 'employee_123',
                        message: 'Bonjour'
                    }
                }
            }
        ], 1);

        expect(responses[0].error.message).toBe('idempotencyKey is required.');
    });
});

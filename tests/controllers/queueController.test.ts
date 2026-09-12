import { beforeEach, describe, expect, it, vi } from 'vitest';

const queueMock = vi.hoisted(() => ({
    getQueueStats: vi.fn(),
    getQueueRuntimeStatus: vi.fn(),
    pauseQueue: vi.fn(),
    resumeQueue: vi.fn()
}));

const redisMock = vi.hoisted(() => ({
    isRedisEnabled: vi.fn(),
    getRedisRuntimeStatus: vi.fn()
}));

const prismaMock = vi.hoisted(() => ({
    platformConfig: {
        findUnique: vi.fn()
    }
}));

vi.mock('../../src/services/queueService', () => queueMock);
vi.mock('../../src/services/redisConnection', () => redisMock);
vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

function createResponse() {
    const res = {
        status: vi.fn(),
        json: vi.fn()
    };
    res.status.mockReturnValue(res);
    return res;
}

describe('queueController', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reports a critical queue health when Redis is enabled but the queue was not initialized', async () => {
        queueMock.getQueueStats.mockResolvedValue({
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: false,
            initialized: false
        });
        queueMock.getQueueRuntimeStatus.mockReturnValue({
            enabled: true,
            initialized: false,
            workerRunning: false,
            eventsInitialized: false,
            redis: {
                enabled: true,
                configured: true,
                connected: false,
                status: 'not_initialized',
                lastError: null
            }
        });
        redisMock.isRedisEnabled.mockReturnValue(true);
        redisMock.getRedisRuntimeStatus.mockReturnValue({
            enabled: true,
            configured: true,
            connected: false,
            status: 'not_initialized',
            lastError: null
        });
        prismaMock.platformConfig.findUnique.mockResolvedValue({
            whatsappQualityScore: 'GREEN',
            whatsappQualityAlert: null
        });

        const { getHealth } = await import('../../src/controllers/queueController');
        const res = createResponse();

        await getHealth({} as any, res as any);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'critical',
            redisEnabled: true,
            queueInitialized: false,
            queueWorkerRunning: false,
            issues: expect.arrayContaining([
                'Redis is enabled but WhatsApp queue is not initialized'
            ])
        }));
    });

    it('does not claim pause success when Redis is enabled but the queue is missing', async () => {
        redisMock.isRedisEnabled.mockReturnValue(true);
        queueMock.getQueueRuntimeStatus.mockReturnValue({
            enabled: true,
            initialized: false,
            workerRunning: false,
            eventsInitialized: false,
            redis: {
                enabled: true,
                configured: true,
                connected: false,
                status: 'not_initialized',
                lastError: null
            }
        });

        const { pause } = await import('../../src/controllers/queueController');
        const res = createResponse();

        await pause({} as any, res as any);

        expect(queueMock.pauseQueue).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Queue WhatsApp non initialisée'
        });
    });
});

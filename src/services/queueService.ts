/**
 * WhatsApp Queue Service
 * Manages outbound message queue with rate limiting to prevent Meta bans.
 * 
 * Features:
 * - Rate limiting (default 10 msgs/sec)
 * - Exponential backoff on 429 errors
 * - Bypass mode for local dev without Redis
 * - Emergency pause/resume controls
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisConnection, isRedisEnabled } from './redisConnection';

// Types for queue jobs
export interface WhatsAppJob {
    type: 'text' | 'interactive_list' | 'interactive_buttons' | 'document' | 'template';
    to: string;
    payload: any;
    config?: any; // WhatsApp credentials for BYON
    tenantId?: string;
    employeeId?: string;
}

export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
}

// Singleton instances
let whatsappQueue: Queue<WhatsAppJob> | null = null;
let whatsappWorker: Worker<WhatsAppJob> | null = null;
let queueEvents: QueueEvents | null = null;
let isPaused = false;

// Rate limit from env (default 10 per second)
const RATE_LIMIT = parseInt(process.env.QUEUE_RATE_LIMIT || '10', 10);

/**
 * Initialize the queue and worker (only if Redis is enabled)
 */
export function initializeQueue(
    processFunction: (job: Job<WhatsAppJob>) => Promise<void>
): void {
    if (!isRedisEnabled()) {
        console.log('⚠️ Redis disabled (USE_REDIS=false). Queue bypassed, direct sends enabled.');
        return;
    }

    const connection = getRedisConnection();

    // Create the queue
    whatsappQueue = new Queue<WhatsAppJob>('whatsapp-outbound', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000 // Start with 2s, then 4s, 8s
            },
            removeOnComplete: {
                count: 1000, // Keep last 1000 completed jobs
                age: 3600   // or 1 hour
            },
            removeOnFail: {
                count: 500,
                age: 86400  // Keep failed jobs for 24h
            }
        }
    });

    // Create the worker with rate limiting
    whatsappWorker = new Worker<WhatsAppJob>(
        'whatsapp-outbound',
        processFunction,
        {
            connection,
            concurrency: 1, // Process one at a time for strict rate control
            limiter: {
                max: RATE_LIMIT,
                duration: 1000 // 1 second
            }
        }
    );

    // Event handlers
    whatsappWorker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed: ${job.data.type} to ${job.data.to}`);
    });

    whatsappWorker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    whatsappWorker.on('error', (err) => {
        console.error('❌ Worker error:', err.message);
    });

    // Queue events for monitoring
    queueEvents = new QueueEvents('whatsapp-outbound', { connection });

    queueEvents.on('waiting', ({ jobId }) => {
        console.log(`📤 Job ${jobId} is waiting`);
    });

    console.log(`🚀 WhatsApp queue initialized (rate limit: ${RATE_LIMIT}/sec)`);
}

/**
 * Add a job to the queue
 * If Redis is disabled, returns null (caller should send directly)
 */
export async function addToQueue(job: WhatsAppJob): Promise<Job<WhatsAppJob> | null> {
    if (!isRedisEnabled() || !whatsappQueue) {
        console.log('⚡ Queue bypassed, returning null for direct send');
        return null;
    }

    const queuedJob = await whatsappQueue.add(job.type, job, {
        priority: job.type === 'text' ? 2 : 1 // Text messages slightly lower priority
    });

    console.log(`📥 Queued job ${queuedJob.id}: ${job.type} to ${job.to}`);
    return queuedJob;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
    if (!whatsappQueue) {
        return {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: false
        };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
        whatsappQueue.getWaitingCount(),
        whatsappQueue.getActiveCount(),
        whatsappQueue.getCompletedCount(),
        whatsappQueue.getFailedCount(),
        whatsappQueue.getDelayedCount()
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused
    };
}

/**
 * Pause the queue (emergency stop)
 */
export async function pauseQueue(): Promise<void> {
    if (whatsappQueue) {
        await whatsappQueue.pause();
        isPaused = true;
        console.log('⏸️ WhatsApp queue PAUSED');
    }
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
    if (whatsappQueue) {
        await whatsappQueue.resume();
        isPaused = false;
        console.log('▶️ WhatsApp queue RESUMED');
    }
}

/**
 * Update the rate limit dynamically
 */
export function updateRateLimit(newLimit: number): void {
    if (whatsappWorker) {
        // Note: BullMQ doesn't support dynamic limiter updates
        // This would require recreating the worker
        console.log(`⚠️ Rate limit update requested: ${newLimit}/sec (requires restart)`);
    }
}

/**
 * Check if queue is paused
 */
export function isQueuePaused(): boolean {
    return isPaused;
}

/**
 * Clean up resources on shutdown
 */
export async function closeQueue(): Promise<void> {
    if (whatsappWorker) {
        await whatsappWorker.close();
        whatsappWorker = null;
    }
    if (queueEvents) {
        await queueEvents.close();
        queueEvents = null;
    }
    if (whatsappQueue) {
        await whatsappQueue.close();
        whatsappQueue = null;
    }
    console.log('🛑 WhatsApp queue closed');
}

export default {
    initializeQueue,
    addToQueue,
    getQueueStats,
    pauseQueue,
    resumeQueue,
    isQueuePaused,
    closeQueue,
    updateRateLimit
};

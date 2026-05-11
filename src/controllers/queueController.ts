/**
 * Queue Controller
 * API endpoints for SuperAdmin to monitor and control the WhatsApp queue.
 */

import { Request, Response } from 'express';
import {
    getQueueStats,
    pauseQueue,
    resumeQueue,
    isQueuePaused
} from '../services/queueService';
import { isRedisEnabled } from '../services/redisConnection';
import prisma from '../lib/prisma';


/**
 * GET /admin/queue/stats
 * Returns queue statistics (waiting, active, completed, failed)
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = await getQueueStats();

        res.json({
            enabled: isRedisEnabled(),
            ...stats
        });
    } catch (error: any) {
        console.error('Error getting queue stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des stats' });
    }
};

/**
 * GET /admin/queue/health
 * Returns overall health status including Meta quality score
 */
export const getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
        // Get platform config for quality score
        const config = await prisma.platformConfig.findUnique({
            where: { id: 1 },
            select: {
                whatsappQualityScore: true,
                whatsappQualityAlert: true
            }
        });

        const stats = await getQueueStats();

        // Determine health status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        const issues: string[] = [];

        // Check quality score
        if (config?.whatsappQualityScore === 'RED') {
            status = 'critical';
            issues.push('Meta quality score is RED - sending paused recommended');
        } else if (config?.whatsappQualityScore === 'YELLOW') {
            status = 'warning';
            issues.push('Meta quality score is YELLOW - reduce sending rate');
        }

        // Check if queue is paused
        if (stats.paused) {
            status = 'warning';
            issues.push('Queue is currently paused');
        }

        // Check failed jobs
        if (stats.failed > 50) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push(`High failure rate: ${stats.failed} failed jobs`);
        }

        res.json({
            status,
            issues,
            redisEnabled: isRedisEnabled(),
            queuePaused: stats.paused,
            qualityScore: config?.whatsappQualityScore || 'GREEN',
            lastQualityAlert: config?.whatsappQualityAlert,
            stats: {
                waiting: stats.waiting,
                active: stats.active,
                completed: stats.completed,
                failed: stats.failed,
                delayed: stats.delayed
            }
        });
    } catch (error: any) {
        console.error('Error getting health status:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification de santé' });
    }
};

/**
 * POST /admin/queue/pause
 * Emergency pause - stops processing the queue
 */
export const pause = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!isRedisEnabled()) {
            res.status(400).json({ error: 'Redis non activé - queue désactivée' });
            return;
        }

        await pauseQueue();

        // Log action
        const superAdmin = req.superAdmin;
        if (superAdmin) {
            console.log(`⏸️ Queue paused by SuperAdmin: ${superAdmin.email}`);
        }

        res.json({
            success: true,
            message: 'Queue mise en pause',
            paused: true
        });
    } catch (error: any) {
        console.error('Error pausing queue:', error);
        res.status(500).json({ error: 'Erreur lors de la mise en pause' });
    }
};

/**
 * POST /admin/queue/resume
 * Resumes processing the queue after a pause
 */
export const resume = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!isRedisEnabled()) {
            res.status(400).json({ error: 'Redis non activé - queue désactivée' });
            return;
        }

        await resumeQueue();

        // Log action
        const superAdmin = req.superAdmin;
        if (superAdmin) {
            console.log(`▶️ Queue resumed by SuperAdmin: ${superAdmin.email}`);
        }

        res.json({
            success: true,
            message: 'Queue reprise',
            paused: false
        });
    } catch (error: any) {
        console.error('Error resuming queue:', error);
        res.status(500).json({ error: 'Erreur lors de la reprise' });
    }
};

export default {
    getStats,
    getHealth,
    pause,
    resume
};

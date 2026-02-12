/**
 * Shared Prisma Client Instance
 * 
 * Replaces per-file `new PrismaClient()` to avoid:
 *  - Connection pool exhaustion (each instance opens its own pool)
 *  - Warm-up latency on every import
 *  - Inconsistent logging / middleware configuration
 * 
 * Usage:
 *   import prisma from '../lib/prisma';
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;

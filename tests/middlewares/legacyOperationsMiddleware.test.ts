import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { requireLegacyOperations } from '../../src/middlewares/legacyOperationsMiddleware';

function callMiddleware() {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    requireLegacyOperations({} as Request, { status } as unknown as Response, next as NextFunction);

    return { json, next, status };
}

describe('legacyOperationsMiddleware', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('allows legacy operations outside production by default', async () => {
        vi.stubEnv('NODE_ENV', 'development');

        const { next, status } = callMiddleware();

        expect(next).toHaveBeenCalledOnce();
        expect(status).not.toHaveBeenCalled();
    });

    it('blocks legacy operations in production by default', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_LEGACY_OPERATIONS', undefined);

        const { json, next, status } = callMiddleware();

        expect(next).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({
            error: 'Legacy operations module is disabled',
            code: 'LEGACY_OPERATIONS_DISABLED'
        });
    });

    it('can explicitly re-enable legacy operations in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_LEGACY_OPERATIONS', 'true');

        const { next, status } = callMiddleware();

        expect(next).toHaveBeenCalledOnce();
        expect(status).not.toHaveBeenCalled();
    });
});

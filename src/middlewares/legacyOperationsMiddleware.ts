import { RequestHandler } from 'express';
import { isFlagEnabled, isProduction } from '../utils/featureFlags';

const ENABLE_LEGACY_OPERATIONS = 'ENABLE_LEGACY_OPERATIONS';

export function areLegacyOperationsEnabled(): boolean {
    return isFlagEnabled(ENABLE_LEGACY_OPERATIONS, !isProduction());
}

export const requireLegacyOperations: RequestHandler = (_req, res, next) => {
    if (areLegacyOperationsEnabled()) {
        return next();
    }

    return res.status(404).json({
        error: 'Legacy operations module is disabled',
        code: 'LEGACY_OPERATIONS_DISABLED'
    });
};


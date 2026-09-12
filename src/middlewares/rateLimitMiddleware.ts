import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';
import { isRedisEnabled } from '../services/redisConnection';
import { RedisRateLimitStore } from '../services/redisRateLimitStore';

const isTest = process.env.NODE_ENV === 'test';
const useRedisRateLimitStore = isRedisEnabled() && process.env.RATE_LIMIT_STORE !== 'memory';

function parseNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;

    return raw === 'true';
}

function createLimiter(name: string, options: Partial<Options>) {
    return rateLimit({
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        store: useRedisRateLimitStore ? new RedisRateLimitStore(name) : undefined,
        passOnStoreError: parseBooleanEnv('RATE_LIMIT_REDIS_PASS_ON_ERROR', false),
        skip: () => isTest,
        message: {
            error: 'Too many requests',
            code: 'RATE_LIMITED'
        },
        ...options,
        handler: (_req, res) => {
            res.status(options.statusCode || 429).json({
                error: 'Too many requests',
                code: 'RATE_LIMITED',
                scope: name
            });
        }
    });
}

export const authRateLimit = createLimiter('auth', {
    windowMs: parseNumberEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    limit: parseNumberEnv('AUTH_RATE_LIMIT_MAX', 50)
});

export const otpRateLimit = createLimiter('otp', {
    windowMs: parseNumberEnv('OTP_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    limit: parseNumberEnv('OTP_RATE_LIMIT_MAX', 10)
});

export const onboardingAccessRateLimit = createLimiter('onboarding-access', {
    windowMs: parseNumberEnv('ONBOARDING_ACCESS_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    limit: parseNumberEnv('ONBOARDING_ACCESS_RATE_LIMIT_MAX', 20)
});

export const resetPasswordRateLimit = createLimiter('reset-password', {
    windowMs: parseNumberEnv('RESET_PASSWORD_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
    limit: parseNumberEnv('RESET_PASSWORD_RATE_LIMIT_MAX', 8)
});

export const webhookRateLimit = createLimiter('webhook', {
    windowMs: parseNumberEnv('WEBHOOK_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    limit: parseNumberEnv('WEBHOOK_RATE_LIMIT_MAX', 300)
});

export const externalNotifyRateLimit = createLimiter('external-notify', {
    windowMs: parseNumberEnv('EXTERNAL_NOTIFY_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    limit: parseNumberEnv('EXTERNAL_NOTIFY_RATE_LIMIT_MAX', 120)
});

export const publicApiRateLimit = createLimiter('public-api', {
    windowMs: parseNumberEnv('PUBLIC_API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    limit: parseNumberEnv('PUBLIC_API_RATE_LIMIT_MAX', 120),
    keyGenerator: (req) => req.publicApi?.apiKeyPrefix || ipKeyGenerator(req.ip || 'unknown')
});

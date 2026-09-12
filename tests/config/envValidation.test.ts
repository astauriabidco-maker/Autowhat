import { describe, expect, it } from 'vitest';
import { assertProductionEnv, validateProductionEnv } from '../../src/config/envValidation';

const VALID_PRODUCTION_ENV = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://prod_user:very_secure_password@db.internal:5432/whatspoint',
    ENCRYPTION_KEY: 'k8N4vY2pQ6rT9wX1zA3cD5fG7hJ9mL0n',
    JWT_SECRET: 'u6zJ8mK2rV4pQ9xL1tN5wY7cD3fG0hS2',
    FILE_URL_SECRET: 'b7H2qW9nM4xC6vR1tY8pL3zK5dF0gJ6s',
    LOG_HASH_SECRET: 'p5L9xQ2vM8nR4cT7wY1zK6dF3hG0sJ2b',
    FRONTEND_URL: 'https://app.whatspoint.com',
    BACKEND_URL: 'https://api.whatspoint.com',
    CORS_ORIGINS: 'https://app.whatspoint.com',
    WHATSAPP_APP_SECRET: 'meta-app-secret-at-least-24-chars',
    WEBHOOK_VERIFY_TOKEN: 'verify-token-at-least-24-chars',
    DEMO_MODE: 'false',
    AUTH_COOKIE_SECURE: 'true',
    AUTH_COOKIE_SAME_SITE: 'lax',
    AUTH_COOKIE_CROSS_SITE: 'false',
    USE_REDIS: 'false',
    RATE_LIMIT_STORE: 'memory'
};

describe('envValidation', () => {
    it('does not enforce production checks outside production', () => {
        const result = validateProductionEnv({
            NODE_ENV: 'test',
            JWT_SECRET: 'short'
        });

        expect(result).toEqual({ ok: true, issues: [] });
    });

    it('rejects placeholder and localhost production values', () => {
        const result = validateProductionEnv({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://admin:secret_dev@localhost:55435/whatsapp_hub',
            ENCRYPTION_KEY: 'your-32-character-secret-key-!!',
            JWT_SECRET: 'your-secure-jwt-secret',
            FILE_URL_SECRET: 'your-secure-jwt-secret',
            LOG_HASH_SECRET: 'your-secure-jwt-secret',
            FRONTEND_URL: 'http://localhost:5180',
            BACKEND_URL: 'http://localhost:3005',
            CORS_ORIGINS: 'http://localhost:5180',
            DEMO_MODE: 'true',
            AUTH_COOKIE_SECURE: 'false'
        });

        expect(result.ok).toBe(false);
        expect(result.issues.filter(issue => issue.severity === 'error').map(issue => issue.variable))
            .toEqual(expect.arrayContaining([
                'DATABASE_URL',
                'ENCRYPTION_KEY',
                'JWT_SECRET',
                'FILE_URL_SECRET',
                'LOG_HASH_SECRET',
                'FRONTEND_URL',
                'BACKEND_URL',
                'CORS_ORIGINS',
                'WHATSAPP_APP_SECRET',
                'WEBHOOK_VERIFY_TOKEN',
                'DEMO_MODE',
                'AUTH_COOKIE_SECURE'
            ]));
    });

    it('accepts a complete production core environment with optional integrations disabled', () => {
        const result = validateProductionEnv(VALID_PRODUCTION_ENV);

        expect(result.ok).toBe(true);
        expect(result.issues.filter(issue => issue.severity === 'error')).toHaveLength(0);
    });

    it('rejects partial Stripe production configuration', () => {
        const result = validateProductionEnv({
            ...VALID_PRODUCTION_ENV,
            STRIPE_SECRET_KEY: 'sk_live_secret_with_enough_length',
            STRIPE_WEBHOOK_SECRET: '',
            STRIPE_PRICE_PRO: ''
        });

        expect(result.ok).toBe(false);
        expect(result.issues.filter(issue => issue.severity === 'error').map(issue => issue.variable))
            .toEqual(expect.arrayContaining([
                'STRIPE_WEBHOOK_SECRET',
                'STRIPE_PRICE_PRO',
                'STRIPE_PRICE_ENTERPRISE'
            ]));
    });

    it('throws a startup-friendly error without exposing secret values', () => {
        expect(() => assertProductionEnv({
            NODE_ENV: 'production',
            JWT_SECRET: 'too-short'
        })).toThrow(/Invalid production environment/);

        expect(() => assertProductionEnv({
            NODE_ENV: 'production',
            JWT_SECRET: 'too-short'
        })).toThrow(/JWT_SECRET/);
    });
});

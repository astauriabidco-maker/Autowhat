import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
const frontendUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5180';
const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3005';

if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_URL_TEST = databaseUrl;
}

process.env.NODE_ENV = 'test';
process.env.ENABLE_JOBS = 'false';
process.env.USE_REDIS = 'false';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.ENABLE_LEGACY_OPERATIONS = 'false';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    expect: {
        timeout: 10_000
    },
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    use: {
        baseURL: frontendUrl,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    webServer: [
        {
            command: 'npm run dev',
            url: `${backendUrl}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
                ...process.env,
                PORT: '3005',
                NODE_ENV: 'test',
                DATABASE_URL: databaseUrl || '',
                DATABASE_URL_TEST: databaseUrl || '',
                ENABLE_JOBS: 'false',
                USE_REDIS: 'false',
                RATE_LIMIT_STORE: 'memory',
                ENABLE_LEGACY_OPERATIONS: 'false',
                SERVE_FRONTEND: 'false',
                ENABLE_SWAGGER: 'false',
                VITE_ENABLE_PWA: 'false'
            }
        },
        {
            command: 'npm --prefix client run dev -- --host 127.0.0.1',
            url: frontendUrl,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
                ...process.env,
                VITE_ENABLE_PWA: 'false'
            }
        }
    ],
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ]
});

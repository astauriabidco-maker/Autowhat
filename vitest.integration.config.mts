import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/integration/**/*.test.ts'],
        setupFiles: ['tests/integration/setupEnv.ts'],
        fileParallelism: false,
        pool: 'forks',
        maxWorkers: 1,
        minWorkers: 1,
        testTimeout: 30000,
        hookTimeout: 30000,
        restoreMocks: true
    }
});

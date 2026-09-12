import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.ENABLE_JOBS = 'false';
process.env.USE_REDIS = 'false';
process.env.SERVE_FRONTEND = 'false';
process.env.ENABLE_SWAGGER = 'false';
process.env.JWT_SECRET ||= 'test-jwt-secret-change-me';
process.env.ENCRYPTION_KEY ||= '12345678901234567890123456789012';
process.env.FILE_URL_SECRET ||= 'test-file-url-secret';
process.env.FRONTEND_URL ||= 'http://localhost:5180';
process.env.CORS_ORIGINS ||= 'http://localhost:5180';

if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

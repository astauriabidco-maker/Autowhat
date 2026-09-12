type Severity = 'error' | 'warning';

export interface EnvValidationIssue {
    severity: Severity;
    variable: string;
    message: string;
}

export interface EnvValidationResult {
    ok: boolean;
    issues: EnvValidationIssue[];
}

const PLACEHOLDER_PATTERNS = [
    /^your-/i,
    /^replace/i,
    /REPLACE_WITH/i,
    /USER:PASSWORD@HOST/i,
    /^\.\.\.$/,
    /change-me/i,
    /secret_dev/i,
    /secret_test/i,
    /example\.com/i,
    /^sk_test_/i,
    /^whsec_mock/i,
    /^test-/i
];

const WEAK_SECRET_PATTERNS = [
    /1234567890/,
    /0123456789/,
    /abcdefghijklmnopqrstuvwxyz/i,
    /qwerty/i,
    /password/i
];

function valueOf(env: NodeJS.ProcessEnv, name: string): string {
    return (env[name] || '').trim();
}

function hasValue(env: NodeJS.ProcessEnv, name: string): boolean {
    return valueOf(env, name).length > 0;
}

function isPlaceholder(value: string): boolean {
    return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(value));
}

function isLocalUrl(value: string): boolean {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

function isHttpsUrl(value: string): boolean {
    return /^https:\/\//i.test(value);
}

function isProbablySecret(value: string, minLength = 32): boolean {
    return value.length >= minLength
        && !isPlaceholder(value)
        && !WEAK_SECRET_PATTERNS.some(pattern => pattern.test(value))
        && new Set(value.split('')).size >= 8;
}

function addIssue(
    issues: EnvValidationIssue[],
    severity: Severity,
    variable: string,
    message: string
): void {
    issues.push({ severity, variable, message });
}

function requireSecret(
    env: NodeJS.ProcessEnv,
    issues: EnvValidationIssue[],
    variable: string,
    minLength = 32
): void {
    const value = valueOf(env, variable);
    if (!value) {
        addIssue(issues, 'error', variable, 'is required in production');
        return;
    }

    if (!isProbablySecret(value, minLength)) {
        addIssue(issues, 'error', variable, `must be a non-placeholder secret with at least ${minLength} characters`);
    }
}

function requireOneSecret(
    env: NodeJS.ProcessEnv,
    issues: EnvValidationIssue[],
    variables: string[],
    minLength = 32
): void {
    const configured = variables.find(variable => hasValue(env, variable));
    if (!configured) {
        addIssue(issues, 'error', variables[0], `one of ${variables.join(', ')} is required in production`);
        return;
    }

    requireSecret(env, issues, configured, minLength);
}

function requireUrl(
    env: NodeJS.ProcessEnv,
    issues: EnvValidationIssue[],
    variable: string,
    { httpsRequired = true }: { httpsRequired?: boolean } = {}
): void {
    const value = valueOf(env, variable);
    if (!value) {
        addIssue(issues, 'error', variable, 'is required in production');
        return;
    }

    if (isPlaceholder(value) || isLocalUrl(value)) {
        addIssue(issues, 'error', variable, 'must not use placeholder or localhost values in production');
    }

    if (httpsRequired && !isHttpsUrl(value)) {
        addIssue(issues, 'error', variable, 'must use https:// in production');
    }
}

function requireDistinctValues(
    env: NodeJS.ProcessEnv,
    issues: EnvValidationIssue[],
    variables: string[]
): void {
    const seen = new Map<string, string>();

    for (const variable of variables) {
        const value = valueOf(env, variable);
        if (!value) continue;

        const previous = seen.get(value);
        if (previous) {
            addIssue(issues, 'error', variable, `must be distinct from ${previous}`);
            continue;
        }

        seen.set(value, variable);
    }
}

function requireBoolean(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[], variable: string): void {
    const value = valueOf(env, variable);
    if (!value) {
        addIssue(issues, 'error', variable, 'is required in production');
        return;
    }

    if (!['true', 'false'].includes(value)) {
        addIssue(issues, 'error', variable, 'must be either true or false');
    }
}

function validateCore(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    if (!hasValue(env, 'DATABASE_URL')) {
        addIssue(issues, 'error', 'DATABASE_URL', 'is required in production');
    } else if (isPlaceholder(valueOf(env, 'DATABASE_URL')) || isLocalUrl(valueOf(env, 'DATABASE_URL'))) {
        addIssue(issues, 'error', 'DATABASE_URL', 'must point to a real production database, not localhost or sample credentials');
    }

    const encryptionKey = valueOf(env, 'ENCRYPTION_KEY');
    if (!encryptionKey) {
        addIssue(issues, 'error', 'ENCRYPTION_KEY', 'is required in production');
    } else if (encryptionKey.length !== 32 || !isProbablySecret(encryptionKey, 32)) {
        addIssue(issues, 'error', 'ENCRYPTION_KEY', 'must be exactly 32 characters and not a weak placeholder/test value');
    }

    requireSecret(env, issues, 'JWT_SECRET');
    requireSecret(env, issues, 'FILE_URL_SECRET');
    requireSecret(env, issues, 'LOG_HASH_SECRET');

    requireDistinctValues(env, issues, ['ENCRYPTION_KEY', 'JWT_SECRET', 'FILE_URL_SECRET', 'LOG_HASH_SECRET']);

    requireUrl(env, issues, 'FRONTEND_URL');
    requireUrl(env, issues, 'BACKEND_URL');
    requireUrl(env, issues, 'BASE_URL');
    requireUrl(env, issues, 'APP_URL');

    const corsOrigins = valueOf(env, 'CORS_ORIGINS');
    if (!corsOrigins) {
        addIssue(issues, 'error', 'CORS_ORIGINS', 'is required in production');
    } else {
        for (const origin of corsOrigins.split(',').map(value => value.trim()).filter(Boolean)) {
            if (origin === '*' || isLocalUrl(origin) || !isHttpsUrl(origin)) {
                addIssue(issues, 'error', 'CORS_ORIGINS', 'must contain only explicit https:// production origins');
                break;
            }
        }
    }
}

function validateWhatsApp(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    requireOneSecret(env, issues, ['WHATSAPP_APP_SECRET', 'META_APP_SECRET', 'FACEBOOK_APP_SECRET'], 24);
    requireOneSecret(env, issues, ['WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_VERIFY_TOKEN'], 24);

    const hasAnyWhatsappCredential = ['WHATSAPP_TOKEN', 'WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_PHONE_NUMBER_ID']
        .some(name => hasValue(env, name));

    if (hasAnyWhatsappCredential) {
        requireSecret(env, issues, 'WHATSAPP_TOKEN', 32);
        if (!hasValue(env, 'WHATSAPP_PHONE_ID')) {
            addIssue(issues, 'error', 'WHATSAPP_PHONE_ID', 'is required when WhatsApp credentials are configured');
        }
        if (!hasValue(env, 'WHATSAPP_PHONE_NUMBER_ID')) {
            addIssue(issues, 'error', 'WHATSAPP_PHONE_NUMBER_ID', 'is required when WhatsApp credentials are configured');
        }
    } else {
        addIssue(issues, 'warning', 'WHATSAPP_TOKEN', 'is not configured; outbound WhatsApp sends will rely on tenant vault credentials');
    }
}

function validateStripe(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    const stripeVariables = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO', 'STRIPE_PRICE_ENTERPRISE'];
    const configured = stripeVariables.filter(name => hasValue(env, name));

    if (configured.length === 0) {
        addIssue(issues, 'warning', 'STRIPE_SECRET_KEY', 'is not configured; billing endpoints will be unavailable');
        return;
    }

    requireSecret(env, issues, 'STRIPE_SECRET_KEY', 24);
    requireSecret(env, issues, 'STRIPE_WEBHOOK_SECRET', 24);

    for (const priceVariable of ['STRIPE_PRICE_PRO', 'STRIPE_PRICE_ENTERPRISE']) {
        if (!hasValue(env, priceVariable)) {
            addIssue(issues, 'error', priceVariable, 'is required when Stripe is configured');
        } else if (!valueOf(env, priceVariable).startsWith('price_')) {
            addIssue(issues, 'error', priceVariable, 'must look like a Stripe price id');
        }
    }
}

function validateRedis(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    const usesRedis = valueOf(env, 'USE_REDIS') === 'true' || valueOf(env, 'RATE_LIMIT_STORE') === 'redis';
    if (!usesRedis) return;

    const redisUrl = valueOf(env, 'REDIS_URL');
    if (!redisUrl) {
        addIssue(issues, 'error', 'REDIS_URL', 'is required when Redis is enabled');
    } else if (isLocalUrl(redisUrl)) {
        addIssue(issues, 'error', 'REDIS_URL', 'must not point to localhost in production');
    }

    if (valueOf(env, 'RATE_LIMIT_REDIS_PASS_ON_ERROR') === 'true') {
        addIssue(issues, 'warning', 'RATE_LIMIT_REDIS_PASS_ON_ERROR', 'is true in production; use only during a documented incident');
    }
}

function validateDemoAndFlags(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    requireBoolean(env, issues, 'DEMO_MODE');

    if (valueOf(env, 'DEMO_MODE') === 'true') {
        addIssue(issues, 'error', 'DEMO_MODE', 'must be false in production');
    }

    if (valueOf(env, 'ENABLE_SWAGGER') === 'true') {
        addIssue(issues, 'warning', 'ENABLE_SWAGGER', 'is enabled in production; expose API docs only behind trusted access controls');
    }

    if (valueOf(env, 'ENABLE_LEGACY_OPERATIONS') === 'true') {
        addIssue(issues, 'warning', 'ENABLE_LEGACY_OPERATIONS', 'is enabled in production; retired operations surfaces are reachable');
    }
}

function validateOperationalReadiness(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    const managedBackups = valueOf(env, 'MANAGED_DATABASE_BACKUPS') === 'true';
    const backupScriptConfigured = hasValue(env, 'BACKUP_DATABASE_URL') || hasValue(env, 'BACKUP_DIR');
    if (!managedBackups && !backupScriptConfigured) {
        addIssue(issues, 'warning', 'MANAGED_DATABASE_BACKUPS', 'is not true and BACKUP_DIR/BACKUP_DATABASE_URL is not set; confirm an external database backup exists before launch');
    }

    const alertTargets = [
        'OPERATIONAL_ALERT_EMAILS',
        'WHATSAPP_POOL_ALERT_EMAILS',
        'SUPERADMIN_ALERT_EMAILS',
        'SUPERADMIN_ALERT_EMAIL',
        'SENTRY_DSN',
        'UPTIME_MONITOR_URL'
    ];
    if (!alertTargets.some(variable => hasValue(env, variable))) {
        addIssue(issues, 'warning', 'OPERATIONAL_ALERT_EMAILS', 'or SENTRY_DSN/UPTIME_MONITOR_URL should be configured so production failures reach the solo operator');
    }

    if (valueOf(env, 'ENABLE_JOBS') !== 'false' && valueOf(env, 'USE_REDIS') !== 'true') {
        addIssue(issues, 'warning', 'USE_REDIS', 'is not true while jobs may run; Redis-backed queues/rate limits are recommended for production');
    }
}

function validateCookies(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
    if (valueOf(env, 'AUTH_COOKIE_SECURE') !== 'true') {
        addIssue(issues, 'error', 'AUTH_COOKIE_SECURE', 'must be true in production');
    }

    const sameSite = valueOf(env, 'AUTH_COOKIE_SAME_SITE').toLowerCase() || 'lax';
    const crossSite = valueOf(env, 'AUTH_COOKIE_CROSS_SITE') === 'true';

    if (crossSite && sameSite !== 'none') {
        addIssue(issues, 'error', 'AUTH_COOKIE_SAME_SITE', 'must be none when AUTH_COOKIE_CROSS_SITE=true');
    }

    if (!crossSite && sameSite === 'none') {
        addIssue(issues, 'warning', 'AUTH_COOKIE_SAME_SITE', 'is none while AUTH_COOKIE_CROSS_SITE is not true');
    }
}

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
    if (env.NODE_ENV !== 'production') {
        return { ok: true, issues: [] };
    }

    const issues: EnvValidationIssue[] = [];
    validateCore(env, issues);
    validateWhatsApp(env, issues);
    validateStripe(env, issues);
    validateRedis(env, issues);
    validateDemoAndFlags(env, issues);
    validateOperationalReadiness(env, issues);
    validateCookies(env, issues);

    return {
        ok: issues.every(issue => issue.severity !== 'error'),
        issues
    };
}

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
    const result = validateProductionEnv(env);
    if (result.ok) return;

    const details = result.issues
        .filter(issue => issue.severity === 'error')
        .map(issue => `- ${issue.variable}: ${issue.message}`)
        .join('\n');

    throw new Error(`Invalid production environment:\n${details}`);
}

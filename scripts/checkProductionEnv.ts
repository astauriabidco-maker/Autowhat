import 'dotenv/config';
import { validateProductionEnv } from '../src/config/envValidation';

const strictWarnings = process.argv.includes('--strict-warnings');
const OPERATIONAL_WARNING_VARIABLES = new Set([
    'MANAGED_DATABASE_BACKUPS',
    'OPERATIONAL_ALERT_EMAILS',
    'USE_REDIS',
    'RATE_LIMIT_REDIS_PASS_ON_ERROR'
]);
const result = validateProductionEnv({
    ...process.env,
    NODE_ENV: 'production'
});

if (result.issues.length > 0) {
    for (const issue of result.issues) {
        const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
        console.error(`${prefix} ${issue.variable}: ${issue.message}`);
    }
}

const strictWarningFailures = result.issues.filter(issue =>
    issue.severity === 'warning' && OPERATIONAL_WARNING_VARIABLES.has(issue.variable)
);

if (!result.ok || (strictWarnings && strictWarningFailures.length > 0)) {
    process.exit(1);
}

const warningCount = result.issues.filter(issue => issue.severity === 'warning').length;
if (warningCount > 0) {
    console.log(`Production environment check passed with ${warningCount} warning(s)`);
    if (strictWarnings) {
        console.log('Operational readiness warnings passed; review remaining optional integration warnings.');
    } else {
        console.log('Re-run with --strict-warnings to fail on operational readiness warnings.');
    }
} else {
    console.log('Production environment check passed');
}

import 'dotenv/config';
import { validateProductionEnv } from '../src/config/envValidation';

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

if (!result.ok) {
    process.exit(1);
}

console.log('Production environment check passed');

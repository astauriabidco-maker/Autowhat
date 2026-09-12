import crypto from 'crypto';

type LogLevel = 'info' | 'warn' | 'error';

type LogValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Date
    | LogValue[]
    | { [key: string]: LogValue };

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi;
const PHONE_PATTERN = /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g;
const GPS_PAIR_PATTERN = /(-?\d{1,3}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/g;
const MAX_STRING_LENGTH = 240;

function hashSecret(): string {
    return process.env.LOG_HASH_SECRET
        || process.env.FILE_URL_SECRET
        || process.env.JWT_SECRET
        || 'whatspoint-log-hash';
}

export function hashLogIdentifier(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }

    return crypto
        .createHmac('sha256', hashSecret())
        .update(String(value))
        .digest('hex')
        .slice(0, 12);
}

export function sanitizeLogText(value: string): string {
    return value
        .replace(URL_PATTERN, '[redacted_url]')
        .replace(GPS_PAIR_PATTERN, '[redacted_gps]')
        .replace(PHONE_PATTERN, '[redacted_phone]')
        .slice(0, MAX_STRING_LENGTH);
}

export function sanitizeError(error: unknown): { name: string; message: string } {
    if (error instanceof Error) {
        return {
            name: error.name || 'Error',
            message: sanitizeLogText(error.message || 'Unknown error')
        };
    }

    return {
        name: 'Error',
        message: sanitizeLogText(String(error ?? 'Unknown error'))
    };
}

function sanitizeField(value: LogValue): LogValue {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === 'string') {
        return sanitizeLogText(value);
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeField);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, sanitizeField(nestedValue)])
        );
    }

    return value;
}

export function logWebhookEvent(level: LogLevel, event: string, fields: Record<string, LogValue> = {}): void {
    const safeFields = sanitizeField(fields);
    const payload = {
        ts: new Date().toISOString(),
        level,
        event,
        ...(safeFields && typeof safeFields === 'object' && !Array.isArray(safeFields) ? safeFields : {})
    };

    console[level](JSON.stringify(payload));
}

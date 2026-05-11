import crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 15 * 60;

function getSigningSecret(): string {
    const secret = process.env.FILE_URL_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('FILE_URL_SECRET or JWT_SECRET is required to sign file URLs');
    }
    return secret;
}

function signatureFor(path: string, expires: number): string {
    return crypto
        .createHmac('sha256', getSigningSecret())
        .update(`${path}:${expires}`)
        .digest('hex');
}

export function signUploadPath(path: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = signatureFor(path, expires);
    return `/api/files${path.replace(/^\/uploads/, '')}?expires=${expires}&sig=${signature}`;
}

export function uploadPathFromUrl(value: string | null | undefined): string | null {
    if (!value) return null;

    if (value.startsWith('/uploads/')) {
        return value;
    }

    if (value.startsWith('/api/files/')) {
        return `/uploads/${value.replace('/api/files/', '').split('?')[0]}`;
    }

    try {
        const parsed = new URL(value);
        if (parsed.pathname.startsWith('/api/files/')) {
            return `/uploads/${parsed.pathname.replace('/api/files/', '')}`;
        }
        return parsed.pathname.startsWith('/uploads/') ? parsed.pathname : null;
    } catch {
        return null;
    }
}

export function signUploadUrlIfNeeded(value: string | null | undefined, ttlSeconds = DEFAULT_TTL_SECONDS): string | null {
    const uploadPath = uploadPathFromUrl(value);
    return uploadPath ? signUploadPath(uploadPath, ttlSeconds) : value || null;
}

export function verifySignedUploadPath(path: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
        return false;
    }

    const expected = signatureFor(path, expires);
    if (signature.length !== expected.length) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function absoluteSignedUploadUrl(baseUrl: string, path: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalizedBase}${signUploadPath(path, ttlSeconds)}`;
}

export function absoluteSignedUploadUrlIfNeeded(
    baseUrl: string,
    value: string | null | undefined,
    ttlSeconds = DEFAULT_TTL_SECONDS
): string | null {
    const uploadPath = uploadPathFromUrl(value);
    return uploadPath ? absoluteSignedUploadUrl(baseUrl, uploadPath, ttlSeconds) : value || null;
}

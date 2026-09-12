/**
 * Versioned encryption utilities for secure storage of API keys and secrets.
 *
 * New payloads use AES-256-GCM with an authentication tag:
 *   v2:<iv hex>:<auth tag hex>:<ciphertext hex>
 *
 * Legacy AES-256-CBC payloads are still readable for existing rows:
 *   <iv hex>:<ciphertext hex>
 */
import crypto from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';
const GCM_PREFIX = 'v2';
const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY is not defined in environment variables');
    }
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
    }
    return Buffer.from(key, 'utf-8');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format "v2:iv:tag:ciphertext" (hex encoded)
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const key = getEncryptionKey();

    const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return [GCM_PREFIX, iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

/**
 * Decrypts a versioned encrypted string.
 * Supports both current AES-256-GCM payloads and legacy AES-256-CBC payloads.
 * @param text - The encrypted string
 * @returns The original plaintext
 */
export function decrypt(text: string): string {
    const parts = text.split(':');

    if (parts[0] === GCM_PREFIX) {
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted text format. Expected "v2:iv:tag:ciphertext"');
        }

        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const encryptedText = parts[3];
        const key = getEncryptionKey();

        if (iv.length !== GCM_IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error('Invalid AES-GCM encrypted text format');
        }

        const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    return decryptLegacyCbc(text);
}

function decryptLegacyCbc(text: string): string {
    const parts = text.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format. Expected "iv:ciphertext"');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getEncryptionKey();

    if (iv.length !== CBC_IV_LENGTH) {
        throw new Error('Invalid AES-CBC encrypted text format');
    }

    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

function isHex(value: string): boolean {
    return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

/**
 * Detects supported encrypted payload formats without decrypting them.
 */
export function isEncryptedSecret(value: string | null | undefined): boolean {
    if (!value) {
        return false;
    }

    const parts = value.split(':');

    if (parts[0] === GCM_PREFIX) {
        return (
            parts.length === 4 &&
            isHex(parts[1]) &&
            Buffer.from(parts[1], 'hex').length === GCM_IV_LENGTH &&
            isHex(parts[2]) &&
            Buffer.from(parts[2], 'hex').length === AUTH_TAG_LENGTH &&
            isHex(parts[3])
        );
    }

    return (
        parts.length === 2 &&
        isHex(parts[0]) &&
        Buffer.from(parts[0], 'hex').length === CBC_IV_LENGTH &&
        isHex(parts[1])
    );
}

/**
 * Encrypts a secret unless it is already in a supported encrypted format.
 */
export function encryptSecret(value: string): string {
    return isEncryptedSecret(value) ? value : encrypt(value);
}

/**
 * Decrypts supported encrypted payloads and returns plaintext values unchanged.
 * Useful while migrating columns that historically stored plaintext tokens.
 */
export function decryptSecretIfEncrypted(value: string): string {
    return isEncryptedSecret(value) ? decrypt(value) : value;
}

/**
 * Checks if the encryption key is properly configured
 * Call this at server startup to fail fast
 */
export function validateEncryptionKey(): void {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        console.error('❌ FATAL: ENCRYPTION_KEY is not defined in environment variables');
        console.error('   Please add a 32-character ENCRYPTION_KEY to your .env file');
        console.error('   Example: ENCRYPTION_KEY=your-32-character-secret-key-!!');
        process.exit(1);
    }
    if (key.length !== 32) {
        console.error(`❌ FATAL: ENCRYPTION_KEY must be exactly 32 characters (got ${key.length})`);
        process.exit(1);
    }
    console.log('🔐 Encryption key validated');
}

/**
 * AES-256-CBC Encryption Utilities
 * Used for secure storage of API keys and secrets in the database.
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

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
 * Encrypts a plaintext string using AES-256-CBC
 * @param text - The plaintext to encrypt
 * @returns Encrypted string in format "iv:ciphertext" (hex encoded)
 */
export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return iv:ciphertext format
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an encrypted string using AES-256-CBC
 * @param text - The encrypted string in format "iv:ciphertext" (hex encoded)
 * @returns The original plaintext
 */
export function decrypt(text: string): string {
    const parts = text.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted text format. Expected "iv:ciphertext"');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
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

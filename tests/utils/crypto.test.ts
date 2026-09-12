import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    decrypt,
    decryptSecretIfEncrypted,
    encrypt,
    encryptSecret,
    isEncryptedSecret
} from '../../src/utils/crypto';

const TEST_KEY = '12345678901234567890123456789012';

function legacyCbcEncrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TEST_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

describe('crypto utilities', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('encrypts new secrets with versioned AES-256-GCM payloads', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);

        const encrypted = encrypt('secret-token');

        expect(encrypted).toMatch(/^v2:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
        expect(isEncryptedSecret(encrypted)).toBe(true);
        expect(decrypt(encrypted)).toBe('secret-token');
    });

    it('still decrypts legacy AES-256-CBC payloads', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
        const legacyPayload = legacyCbcEncrypt('legacy-token');

        expect(isEncryptedSecret(legacyPayload)).toBe(true);
        expect(decrypt(legacyPayload)).toBe('legacy-token');
    });

    it('keeps plaintext values readable during progressive migrations', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);

        expect(isEncryptedSecret('EAA_plain_meta_token')).toBe(false);
        expect(decryptSecretIfEncrypted('EAA_plain_meta_token')).toBe('EAA_plain_meta_token');
    });

    it('does not double-encrypt an existing encrypted secret', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
        const encrypted = encrypt('already-secret');

        expect(encryptSecret(encrypted)).toBe(encrypted);
    });
});

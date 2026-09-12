import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    classifyWhatsappToken,
    migrateWhatsappTokenToGcm,
    shouldMigrateWhatsappToken
} from '../../scripts/migrateWhatsappTokensToGcm';
import { decrypt, encrypt } from '../../src/utils/crypto';

const TEST_KEY = '12345678901234567890123456789012';

function legacyCbcEncrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(TEST_KEY, 'utf-8'), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

describe('WhatsApp token AES-GCM migration helpers', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('leaves current AES-GCM tokens unchanged', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
        const gcmToken = encrypt('already-gcm');

        expect(classifyWhatsappToken(gcmToken)).toBe('gcm');
        expect(shouldMigrateWhatsappToken(gcmToken)).toBe(false);
        expect(migrateWhatsappTokenToGcm(gcmToken)).toBe(gcmToken);
    });

    it('rewrites legacy AES-CBC tokens to AES-GCM', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);
        const legacyToken = legacyCbcEncrypt('legacy-token');

        expect(classifyWhatsappToken(legacyToken)).toBe('legacy-cbc');
        expect(shouldMigrateWhatsappToken(legacyToken)).toBe(true);

        const migratedToken = migrateWhatsappTokenToGcm(legacyToken);

        expect(migratedToken).toMatch(/^v2:/);
        expect(migratedToken).not.toBe(legacyToken);
        expect(decrypt(migratedToken)).toBe('legacy-token');
    });

    it('rewrites plaintext tokens to AES-GCM', () => {
        vi.stubEnv('ENCRYPTION_KEY', TEST_KEY);

        expect(classifyWhatsappToken('EAA_plain_meta_token')).toBe('plaintext');
        expect(shouldMigrateWhatsappToken('EAA_plain_meta_token')).toBe(true);

        const migratedToken = migrateWhatsappTokenToGcm('EAA_plain_meta_token');

        expect(migratedToken).toMatch(/^v2:/);
        expect(decrypt(migratedToken)).toBe('EAA_plain_meta_token');
    });
});

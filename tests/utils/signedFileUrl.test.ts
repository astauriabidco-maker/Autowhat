import { describe, expect, it, vi } from 'vitest';
import {
    absoluteSignedUploadUrl,
    signUploadPath,
    signUploadUrlIfNeeded,
    uploadPathFromUrl,
    verifySignedUploadPath
} from '../../src/utils/signedFileUrl';

describe('signedFileUrl utilities', () => {
    it('normalizes upload paths from internal API file URLs', () => {
        expect(uploadPathFromUrl('/uploads/documents/contract.pdf')).toBe('/uploads/documents/contract.pdf');
        expect(uploadPathFromUrl('/api/files/documents/contract.pdf?expires=123&sig=abc')).toBe('/uploads/documents/contract.pdf');
        expect(uploadPathFromUrl('https://example.test/api/files/signatures/sig.png?expires=123&sig=abc')).toBe('/uploads/signatures/sig.png');
        expect(uploadPathFromUrl('https://example.test/assets/logo.png')).toBeNull();
    });

    it('signs and verifies upload paths using the configured secret', () => {
        vi.stubEnv('FILE_URL_SECRET', 'test-file-secret');
        vi.setSystemTime(new Date('2026-09-11T12:00:00Z'));

        const signedPath = signUploadPath('/uploads/documents/contract.pdf', 60);
        const parsed = new URL(`https://example.test${signedPath}`);
        const expires = Number(parsed.searchParams.get('expires'));
        const signature = parsed.searchParams.get('sig') || '';

        expect(parsed.pathname).toBe('/api/files/documents/contract.pdf');
        expect(verifySignedUploadPath('/uploads/documents/contract.pdf', expires, signature)).toBe(true);
        expect(verifySignedUploadPath('/uploads/documents/other.pdf', expires, signature)).toBe(false);
    });

    it('does not resign external non-upload URLs', () => {
        vi.stubEnv('FILE_URL_SECRET', 'test-file-secret');

        expect(signUploadUrlIfNeeded('https://cdn.example.test/public.pdf')).toBe('https://cdn.example.test/public.pdf');
        expect(absoluteSignedUploadUrl('https://app.example.test/', '/uploads/documents/contract.pdf', 60))
            .toContain('https://app.example.test/api/files/documents/contract.pdf');
    });
});

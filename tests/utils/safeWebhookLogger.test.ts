import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    hashLogIdentifier,
    logWebhookEvent,
    sanitizeError,
    sanitizeLogText
} from '../../src/utils/safeWebhookLogger';

describe('safeWebhookLogger', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('redacts URLs, phone numbers, and GPS coordinate pairs from text', () => {
        const text = sanitizeLogText(
            'Call +33612345678 and open https://billing.stripe.test/invoice at 48.856614, 2.352222'
        );

        expect(text).toContain('[redacted_phone]');
        expect(text).toContain('[redacted_url]');
        expect(text).toContain('[redacted_gps]');
        expect(text).not.toContain('+33612345678');
        expect(text).not.toContain('billing.stripe.test');
        expect(text).not.toContain('48.856614');
    });

    it('hashes identifiers without returning the original value', () => {
        const hash = hashLogIdentifier('cus_sensitive_123');

        expect(hash).toMatch(/^[a-f0-9]{12}$/);
        expect(hash).not.toBe('cus_sensitive_123');
    });

    it('sanitizes error messages before logging', () => {
        const error = sanitizeError(new Error('Failed for +33612345678 at https://example.test/pay'));

        expect(error).toEqual({
            name: 'Error',
            message: 'Failed for [redacted_phone] at [redacted_url]'
        });
    });

    it('emits structured logs with sanitized fields', () => {
        const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        logWebhookEvent('warn', 'stripe.payment_failed', {
            invoiceUrl: 'https://billing.stripe.test/invoice',
            customerPhone: '+33612345678'
        });

        expect(logSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(logSpy.mock.calls[0][0] as string);

        expect(payload.event).toBe('stripe.payment_failed');
        expect(payload.invoiceUrl).toBe('[redacted_url]');
        expect(payload.customerPhone).toBe('[redacted_phone]');
    });
});

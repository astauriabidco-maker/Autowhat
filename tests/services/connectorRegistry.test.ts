import { describe, expect, it } from 'vitest';
import {
    findConnectorForWebhookEvent,
    getConnectorDefinition,
    getConnectorDefinitions,
    isConnectorEvent,
    isConnectorWebhookTarget
} from '../../src/services/connectorRegistry';

describe('connectorRegistry', () => {
    it('registers Kalldy as a versioned connector definition', () => {
        const kalldy = getConnectorDefinition('kalldy');

        expect(kalldy).toEqual(expect.objectContaining({
            provider: 'KALLDY',
            displayName: 'Kalldy Paie',
            version: 'KALLDY_V1',
            requiresTenantScopedEvents: true
        }));
        expect(getConnectorDefinitions()).toContain(kalldy);
    });

    it('matches connector webhooks and contract events without hard-coded service calls', () => {
        const webhook = {
            name: 'Kalldy POC',
            url: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint'
        };

        expect(isConnectorWebhookTarget('KALLDY', webhook)).toBe(true);
        expect(isConnectorEvent('KALLDY', 'leave.approved')).toBe(true);
        expect(isConnectorEvent('KALLDY', 'expense.submitted')).toBe(false);
        expect(findConnectorForWebhookEvent(webhook, 'document.received')?.provider).toBe('KALLDY');
        expect(findConnectorForWebhookEvent(webhook, 'expense.submitted')).toBeNull();
    });
});

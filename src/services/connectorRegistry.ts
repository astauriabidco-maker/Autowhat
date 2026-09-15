export type ConnectorEnvironment = 'sandbox' | 'production' | 'custom';
export type ConnectorProvider = 'KALLDY';

export type ConnectorDefinition = {
    provider: ConnectorProvider;
    name: string;
    displayName: string;
    version: string;
    docsUrl: string;
    openApiUrl: string;
    requiredEvents: readonly string[];
    endpoints: {
        sandbox: string;
        production: string;
    };
    requiresTenantScopedEvents: boolean;
    matchWebhook: (webhook: { name?: string | null; url?: string | null }) => boolean;
};

const KALLDY_REQUIRED_EVENTS = [
    'leave.approved',
    'document.received',
    'employee.secure_link.requested'
] as const;

const CONNECTOR_DEFINITIONS: Record<ConnectorProvider, ConnectorDefinition> = {
    KALLDY: {
        provider: 'KALLDY',
        name: 'Kalldy',
        displayName: 'Kalldy Paie',
        version: 'KALLDY_V1',
        docsUrl: '/docs/kalldy-v1.md',
        openApiUrl: '/api/docs/public-v1.yaml',
        requiredEvents: KALLDY_REQUIRED_EVENTS,
        endpoints: {
            sandbox: 'https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint',
            production: 'https://api.fr.paie.kalldy.com/api/webhooks/whatspoint'
        },
        requiresTenantScopedEvents: true,
        matchWebhook: webhook => {
            const name = webhook.name?.toLowerCase() || '';
            const url = webhook.url?.toLowerCase() || '';
            return name.includes('kalldy') || url.includes('kalldy');
        }
    }
};

export function getConnectorDefinitions() {
    return Object.values(CONNECTOR_DEFINITIONS);
}

export function getConnectorDefinition(provider: string) {
    return CONNECTOR_DEFINITIONS[provider.toUpperCase() as ConnectorProvider] || null;
}

export function isConnectorWebhookTarget(provider: string, webhook: { name?: string | null; url?: string | null }) {
    const definition = getConnectorDefinition(provider);
    return definition ? definition.matchWebhook(webhook) : false;
}

export function isConnectorEvent(provider: string, eventType: string) {
    const definition = getConnectorDefinition(provider);
    return definition ? definition.requiredEvents.includes(eventType) : false;
}

export function findConnectorForWebhookEvent(
    webhook: { name?: string | null; url?: string | null },
    eventType: string
) {
    return getConnectorDefinitions().find(definition =>
        definition.requiredEvents.includes(eventType) && definition.matchWebhook(webhook)
    ) || null;
}

export { KALLDY_REQUIRED_EVENTS };

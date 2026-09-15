import {
    getConnectorDefinition,
    getConnectorStatus,
    isConnectorEvent,
    isConnectorWebhookTarget,
    updateConnectorWebhookEvents
} from './connectorService';
import { KALLDY_REQUIRED_EVENTS } from './connectorRegistry';

const KALLDY_DEFINITION = getConnectorDefinition('KALLDY');

export const KALLDY_CONNECTOR_VERSION = KALLDY_DEFINITION?.version || 'KALLDY_V1';
export { KALLDY_REQUIRED_EVENTS };

export function isKalldyWebhookTarget(webhook: { name?: string | null; url?: string | null }) {
    return isConnectorWebhookTarget('KALLDY', webhook);
}

export function isKalldyConnectorEvent(eventType: string) {
    return isConnectorEvent('KALLDY', eventType);
}

export async function getKalldyConnectorStatus() {
    const status = await getConnectorStatus('KALLDY');
    if (!status.ok) {
        throw new Error(status.error);
    }

    const { ok, name, displayName, docsUrl, openApiUrl, ...payload } = status;
    void ok;
    void name;
    void displayName;
    void docsUrl;
    void openApiUrl;
    return payload;
}

export async function updateKalldyWebhookEvents(webhookId: string, events: string[]) {
    return updateConnectorWebhookEvents('KALLDY', webhookId, events);
}

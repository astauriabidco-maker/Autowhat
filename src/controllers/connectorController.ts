import { Request, Response } from 'express';
import {
    getConnectorDefinition,
    getConnectorsStatus,
    getConnectorStatus,
    updateConnectorWebhookEvents
} from '../services/connectorService';
import { TestWebhookEventType, testWebhook } from '../services/webhookService';

export async function getConnectors(_req: Request, res: Response) {
    try {
        const connectors = await getConnectorsStatus();
        res.json({ connectors });
    } catch (error) {
        console.error('Error fetching connectors:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des connecteurs' });
    }
}

export async function getConnector(req: Request, res: Response) {
    try {
        const provider = String(req.params.provider || '');
        const status = await getConnectorStatus(provider);
        if (!status.ok) {
            return res.status(status.status).json({ error: status.error });
        }

        const { ok, ...payload } = status;
        void ok;
        res.json(payload);
    } catch (error) {
        console.error('Error fetching connector:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du connecteur' });
    }
}

export async function updateConnectorEvents(req: Request, res: Response) {
    try {
        const provider = String(req.params.provider || '');
        const webhookId = String(req.params.id || '');
        const { events } = req.body;
        if (!Array.isArray(events)) {
            return res.status(400).json({ error: 'events doit être un tableau' });
        }

        const result = await updateConnectorWebhookEvents(provider, webhookId, events);
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }

        res.json(result.webhook);
    } catch (error) {
        console.error('Error updating connector events:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour des événements du connecteur' });
    }
}

export async function testConnectorEvent(req: Request, res: Response) {
    try {
        const provider = String(req.params.provider || '');
        const webhookId = String(req.params.id || '');
        const definition = getConnectorDefinition(provider);
        if (!definition) {
            return res.status(404).json({ error: 'Connecteur inconnu' });
        }

        const eventType = String(req.body?.eventType || '').trim();
        if (!definition.requiredEvents.includes(eventType)) {
            return res.status(400).json({ error: `Événement ${definition.name} invalide` });
        }

        const result = await testWebhook(webhookId, { eventType: eventType as TestWebhookEventType });
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error testing connector webhook:', error);
        res.status(500).json({ error: 'Erreur lors du test du connecteur' });
    }
}

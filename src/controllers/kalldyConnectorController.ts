import { Request, Response } from 'express';
import { getKalldyConnectorStatus, updateKalldyWebhookEvents } from '../services/kalldyConnectorService';

export async function getKalldyStatus(_req: Request, res: Response): Promise<void> {
    try {
        res.json(await getKalldyConnectorStatus());
    } catch (error) {
        console.error('Error fetching Kalldy connector status:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du statut Kalldy' });
    }
}

export async function updateKalldyEvents(req: Request, res: Response): Promise<void> {
    try {
        const idParam = req.params.id;
        const id = Array.isArray(idParam) ? idParam[0] : idParam;
        const { events } = req.body;

        if (!Array.isArray(events)) {
            res.status(400).json({ error: 'events doit être un tableau' });
            return;
        }

        const result = await updateKalldyWebhookEvents(id, events);

        if (!result.ok) {
            res.status(result.status).json({ error: result.error });
            return;
        }

        res.json({ success: true, webhook: result.webhook });
    } catch (error) {
        console.error('Error updating Kalldy connector events:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour des événements Kalldy' });
    }
}

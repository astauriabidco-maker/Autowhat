import { Request, Response } from 'express';
import { getKalldyConnectorStatus } from '../services/kalldyConnectorService';

export async function getKalldyStatus(_req: Request, res: Response): Promise<void> {
    try {
        res.json(await getKalldyConnectorStatus());
    } catch (error) {
        console.error('Error fetching Kalldy connector status:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du statut Kalldy' });
    }
}

import { Router, Request, Response } from 'express';
import { identifyUser } from '../services/authService';
import { runLateArrivalScan } from '../jobs/lateArrivalJob';

const router = Router();

// Endpoint de test pour identifier un utilisateur par son numéro de téléphone
router.post('/identify', async (req: Request, res: Response): Promise<void> => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        res.status(400).json({ error: 'phoneNumber is required' });
        return;
    }

    try {
        const employee = await identifyUser(phoneNumber);

        if (employee) {
            res.status(200).json({
                employeeName: employee.name,
                companyName: employee.tenant.name,
                role: employee.role,
            });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error identifying user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Manually trigger the late arrival scan for testing
 */
router.post('/trigger-alerts', async (req: Request, res: Response): Promise<void> => {
    console.log('🛠 [Debug] Manual trigger: Late Arrival Scan');
    try {
        await runLateArrivalScan();
        res.status(200).json({ message: 'Late arrival scan triggered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to trigger scan' });
    }
});

export default router;

import { Router, Request, Response } from 'express';
import { identifyUser } from '../services/authService';

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

export default router;

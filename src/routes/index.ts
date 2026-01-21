import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';
import debugRoutes from './debugRoutes';

const router = Router();

// Webhook Routes
router.get('/webhook', webhookController.verifyWebhook);
router.post('/webhook', webhookController.handleMessage);

// Debug Routes
router.use('/debug', debugRoutes);

export default router;

import { Router } from 'express';
import * as publicApiV1Controller from '../controllers/publicApiV1Controller';
import {
    authenticatePublicApiKey,
    publicApiAuditLog,
    publicApiRequestContext,
    requireApiScope
} from '../middlewares/publicApiMiddleware';
import { publicApiRateLimit } from '../middlewares/rateLimitMiddleware';

const router = Router();

router.use(publicApiRequestContext);
router.use(publicApiAuditLog);
router.use(authenticatePublicApiKey);
router.use(publicApiRateLimit);

router.get('/me', requireApiScope('tenant:read'), publicApiV1Controller.getMe);
router.post('/messages', requireApiScope('messages:send'), publicApiV1Controller.sendMessageToEmployee);

export default router;

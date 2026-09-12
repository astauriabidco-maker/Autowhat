import { Request, Response } from 'express';
import {
    requestAccessPublicResponse,
    requestOnboardingAccess
} from '../services/onboardingAccessService';
import { logWebhookEvent, sanitizeError } from '../utils/safeWebhookLogger';

function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) {
        return forwardedFor[0] || req.ip || req.socket.remoteAddress || '';
    }

    return forwardedFor?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
}

export const requestAccess = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber, country, locale, source, turnstileToken } = req.body || {};

        await requestOnboardingAccess({
            phoneNumber,
            country,
            locale,
            source,
            turnstileToken,
            ip: getClientIp(req),
            userAgent: req.headers['user-agent']
        });

        res.status(202).json(requestAccessPublicResponse);
    } catch (error) {
        logWebhookEvent('error', 'ONBOARDING_ACCESS_REQUEST_FAILED', {
            error: sanitizeError(error)
        });

        res.status(202).json(requestAccessPublicResponse);
    }
};

import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import prisma from '../lib/prisma';
import { getDefaultConfig } from './whatsappConfigService';
import { sendRawTemplateMessage } from './whatsappService';
import { logWebhookEvent, sanitizeError } from '../utils/safeWebhookLogger';

type SkipReason =
    | 'PHONE_INVALID'
    | 'COUNTRY_NOT_ALLOWED'
    | 'PHONE_RATE_LIMITED'
    | 'IP_RATE_LIMITED'
    | 'COOLDOWN_ACTIVE'
    | 'GLOBAL_DAILY_BUDGET_EXCEEDED'
    | 'COUNTRY_DAILY_BUDGET_EXCEEDED'
    | 'DISPOSABLE_OR_VOIP'
    | 'CHALLENGE_REQUIRED'
    | 'CHALLENGE_FAILED'
    | 'SEND_FAILED';

export interface RequestAccessInput {
    phoneNumber: string;
    country?: string;
    locale?: string;
    source?: string;
    turnstileToken?: string;
    ip?: string;
    userAgent?: string;
}

export interface RequestAccessResult {
    accepted: boolean;
    status: 'SENT' | 'SKIPPED' | 'FAILED';
    skipReason?: SkipReason;
    countryCode: string;
}

const GENERIC_PUBLIC_MESSAGE = 'Si ce numéro est valide, vous allez recevoir un message WhatsApp.';
const DEFAULT_ALLOWED_COUNTRIES = 'FR,BE,CH,LU,CA,CM,SN,CI';

export const requestAccessPublicResponse = {
    success: true,
    status: 'REQUEST_ACCEPTED',
    message: GENERIC_PUBLIC_MESSAGE,
    nextAction: 'CHECK_WHATSAPP'
};

function parseNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseCsvEnv(name: string, fallback = ''): Set<string> {
    return new Set(
        (process.env[name] || fallback)
            .split(',')
            .map(value => value.trim().toUpperCase())
            .filter(Boolean)
    );
}

function parseDailyCountryLimits(): Record<string, number> {
    const raw = process.env.ONBOARDING_DAILY_COUNTRY_LIMITS;
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([country, value]) => [country.toUpperCase(), Number(value)] as const)
                .filter(([, value]) => Number.isFinite(value) && value >= 0)
        );
    } catch {
        return {};
    }
}

function hashForStorage(value?: string): string | null {
    const normalized = (value || '').trim();
    if (!normalized) return null;

    const secret = process.env.LOG_HASH_SECRET
        || process.env.FILE_URL_SECRET
        || process.env.JWT_SECRET
        || 'whatspoint-onboarding-access-hash';

    return crypto
        .createHmac('sha256', secret)
        .update(normalized)
        .digest('hex');
}

function normalizeCountry(country?: string): string | undefined {
    const normalized = country?.trim().toUpperCase();
    return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizePhone(phoneNumber: string, country?: string) {
    const preferredCountry = normalizeCountry(country) as CountryCode | undefined;
    const phone = parsePhoneNumberFromString(phoneNumber, preferredCountry);

    if (!phone || !phone.isValid()) {
        return null;
    }

    return {
        e164: phone.number,
        whatsappTo: phone.number.replace(/^\+/, ''),
        countryCode: phone.country || preferredCountry || 'UNKNOWN'
    };
}

function startOfUtcDay(date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isDisposableOrVoipBlocked(e164: string): boolean {
    const prefixes = (process.env.ONBOARDING_BLOCKED_PHONE_PREFIXES || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

    return prefixes.some(prefix => e164.startsWith(prefix));
}

async function countRequestsSince(where: Record<string, unknown>, since: Date): Promise<number> {
    return prisma.onboardingAccessRequest.count({
        where: {
            ...where,
            requestedAt: {
                gte: since
            }
        }
    });
}

async function recordSkipped(input: {
    phoneHash: string;
    ipHash?: string | null;
    userAgentHash?: string | null;
    countryCode: string;
    skipReason: SkipReason;
    metadata?: Prisma.InputJsonObject;
    challengeProvider?: string;
    challengePassed?: boolean;
}): Promise<RequestAccessResult> {
    await prisma.onboardingAccessRequest.create({
        data: {
            phoneHash: input.phoneHash,
            ipHash: input.ipHash,
            userAgentHash: input.userAgentHash,
            countryCode: input.countryCode,
            status: 'SKIPPED',
            skipReason: input.skipReason,
            skippedAt: new Date(),
            challengeProvider: input.challengeProvider,
            challengePassed: input.challengePassed,
            metadata: input.metadata
        }
    });

    return {
        accepted: false,
        status: 'SKIPPED',
        skipReason: input.skipReason,
        countryCode: input.countryCode
    };
}

export async function requestOnboardingAccess(input: RequestAccessInput): Promise<RequestAccessResult> {
    const rawPhone = String(input.phoneNumber || '').trim();
    const ipHash = hashForStorage(input.ip || undefined);
    const userAgentHash = hashForStorage(input.userAgent || undefined);
    const rawPhoneHash = hashForStorage(rawPhone) || hashForStorage('missing-phone')!;
    const inputCountry = normalizeCountry(input.country);
    const metadata = {
        source: input.source || 'unknown',
        locale: input.locale || 'fr',
        inputCountry: inputCountry || null
    };

    const normalizedPhone = normalizePhone(rawPhone, inputCountry);
    if (!normalizedPhone) {
        return recordSkipped({
            phoneHash: rawPhoneHash,
            ipHash,
            userAgentHash,
            countryCode: inputCountry || 'UNKNOWN',
            skipReason: 'PHONE_INVALID',
            metadata
        });
    }

    const phoneHash = hashForStorage(normalizedPhone.e164)!;
    const countryCode = normalizedPhone.countryCode;
    const allowedCountries = parseCsvEnv('ONBOARDING_ALLOWED_COUNTRIES', DEFAULT_ALLOWED_COUNTRIES);
    const blockedCountries = parseCsvEnv('ONBOARDING_BLOCKED_COUNTRIES');

    if (blockedCountries.has(countryCode) || !allowedCountries.has(countryCode)) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'COUNTRY_NOT_ALLOWED',
            metadata
        });
    }

    if (isDisposableOrVoipBlocked(normalizedPhone.e164)) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'DISPOSABLE_OR_VOIP',
            metadata
        });
    }

    const now = new Date();
    const cooldownHours = parseNumberEnv('ONBOARDING_PHONE_COOLDOWN_HOURS', 24);
    const cooldownSince = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
    const hourlySince = new Date(now.getTime() - 60 * 60 * 1000);
    const dayStart = startOfUtcDay(now);

    if (cooldownHours > 0 && await countRequestsSince({ phoneHash, status: 'SENT' }, cooldownSince) > 0) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'COOLDOWN_ACTIVE',
            metadata
        });
    }

    const phoneDailyLimit = parseNumberEnv('ONBOARDING_PHONE_DAILY_LIMIT', 3);
    if (phoneDailyLimit > 0 && await countRequestsSince({ phoneHash, status: 'SENT' }, dayStart) >= phoneDailyLimit) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'PHONE_RATE_LIMITED',
            metadata
        });
    }

    const ipHourlyLimit = parseNumberEnv('ONBOARDING_IP_HOURLY_LIMIT', 5);
    if (ipHash && ipHourlyLimit > 0 && await countRequestsSince({ ipHash }, hourlySince) >= ipHourlyLimit) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'IP_RATE_LIMITED',
            metadata
        });
    }

    const challengeEnabled = process.env.ONBOARDING_TURNSTILE_ENABLED === 'true';
    const challengeThreshold = parseNumberEnv('ONBOARDING_TURNSTILE_IP_THRESHOLD', 3);
    if (
        challengeEnabled
        && ipHash
        && !input.turnstileToken
        && await countRequestsSince({ ipHash }, hourlySince) >= challengeThreshold
    ) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'CHALLENGE_REQUIRED',
            challengeProvider: 'TURNSTILE',
            challengePassed: false,
            metadata
        });
    }

    const dailyGlobalLimit = parseNumberEnv('ONBOARDING_DAILY_GLOBAL_LIMIT', 200);
    if (dailyGlobalLimit > 0 && await countRequestsSince({ status: 'SENT' }, dayStart) >= dailyGlobalLimit) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'GLOBAL_DAILY_BUDGET_EXCEEDED',
            metadata
        });
    }

    const countryLimits = parseDailyCountryLimits();
    const countryDailyLimit = countryLimits[countryCode] ?? parseNumberEnv('ONBOARDING_DAILY_COUNTRY_LIMIT', 50);
    if (countryDailyLimit > 0 && await countRequestsSince({ countryCode, status: 'SENT' }, dayStart) >= countryDailyLimit) {
        return recordSkipped({
            phoneHash,
            ipHash,
            userAgentHash,
            countryCode,
            skipReason: 'COUNTRY_DAILY_BUDGET_EXCEEDED',
            metadata
        });
    }

    const templateName = process.env.WHATSAPP_ONBOARDING_ACCESS_TEMPLATE || 'whatspoint_request_access_fr';
    const languageCode = input.locale || process.env.WHATSAPP_ONBOARDING_ACCESS_TEMPLATE_LANG || 'fr';
    const defaultConfig = getDefaultConfig();

    try {
        if (!defaultConfig.phoneNumberId || !defaultConfig.accessToken) {
            throw new Error('Default WhatsApp credentials are not configured');
        }

        const sendResult = await sendRawTemplateMessage(
            normalizedPhone.whatsappTo,
            templateName,
            languageCode,
            [],
            defaultConfig
        );
        if (!sendResult.success) {
            throw new Error(sendResult.error || 'WhatsApp template send failed');
        }

        await prisma.onboardingAccessRequest.create({
            data: {
                phoneHash,
                ipHash,
                userAgentHash,
                countryCode,
                status: 'SENT',
                channel: 'WHATSAPP',
                provider: 'META',
                sentAt: new Date(),
                challengeProvider: challengeEnabled ? 'TURNSTILE' : undefined,
                challengePassed: challengeEnabled ? Boolean(input.turnstileToken) : undefined,
                metadata
            }
        });

        return {
            accepted: true,
            status: 'SENT',
            countryCode
        };
    } catch (error) {
        logWebhookEvent('error', 'ONBOARDING_ACCESS_SEND_FAILED', {
            countryCode,
            phoneHash: phoneHash.slice(0, 12),
            error: sanitizeError(error)
        });

        await prisma.onboardingAccessRequest.create({
            data: {
                phoneHash,
                ipHash,
                userAgentHash,
                countryCode,
                status: 'FAILED',
                skipReason: 'SEND_FAILED',
                channel: 'WHATSAPP',
                provider: 'META',
                failedAt: new Date(),
                metadata
            }
        });

        return {
            accepted: false,
            status: 'FAILED',
            skipReason: 'SEND_FAILED',
            countryCode
        };
    }
}

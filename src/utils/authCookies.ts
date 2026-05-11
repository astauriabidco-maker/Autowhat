import { CookieOptions, Response } from 'express';

export const MANAGER_AUTH_COOKIE = 'wp_manager_token';
export const SUPERADMIN_AUTH_COOKIE = 'wp_superadmin_token';

const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ALLOWED_SAME_SITE_VALUES = ['lax', 'strict', 'none'] as const;
type SameSiteMode = typeof ALLOWED_SAME_SITE_VALUES[number];

function sameSiteMode(): SameSiteMode {
    const configured = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();

    if (configured && ALLOWED_SAME_SITE_VALUES.includes(configured as SameSiteMode)) {
        return configured as SameSiteMode;
    }

    if (process.env.AUTH_COOKIE_CROSS_SITE === 'true') {
        return 'none';
    }

    return 'lax';
}

function isSecureCookie(sameSite: SameSiteMode): boolean {
    return sameSite === 'none'
        || process.env.AUTH_COOKIE_SECURE === 'true'
        || process.env.NODE_ENV === 'production';
}

function cookieOptions(): CookieOptions {
    const sameSite = sameSiteMode();

    return {
        httpOnly: true,
        secure: isSecureCookie(sameSite),
        sameSite,
        path: '/',
        maxAge: COOKIE_MAX_AGE_MS
    };
}

function clearCookieOptions(): CookieOptions {
    const { maxAge: _maxAge, ...options } = cookieOptions();
    return options;
}

export function setManagerAuthCookie(res: Response, token: string): void {
    res.cookie(MANAGER_AUTH_COOKIE, token, cookieOptions());
}

export function setSuperAdminAuthCookie(res: Response, token: string): void {
    res.cookie(SUPERADMIN_AUTH_COOKIE, token, cookieOptions());
}

export function clearAuthCookies(res: Response): void {
    res.clearCookie(MANAGER_AUTH_COOKIE, clearCookieOptions());
    res.clearCookie(SUPERADMIN_AUTH_COOKIE, clearCookieOptions());
}

export function clearManagerAuthCookie(res: Response): void {
    res.clearCookie(MANAGER_AUTH_COOKIE, clearCookieOptions());
}

/**
 * Privacy Anonymizer Module
 * 
 * Pure module (no DB dependencies) for anonymizing sensitive data
 * before sending to WhatsApp/Meta APIs.
 * 
 * IMPORTANT: All transformations are DETERMINISTIC - the same input
 * always produces the same output for consistency.
 */

import * as crypto from 'crypto';

export interface AnonymizeContext {
    siteId?: string;
    siteName?: string;
    employeeId?: string;
    employeeName?: string;
    tenantId?: string;
}

/**
 * Generate a deterministic short hash from a string.
 * Always produces the same 4-character code for the same input.
 */
function generateShortHash(input: string, prefix: string = ''): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    // Take first 4 chars of hash, uppercase
    const shortCode = hash.substring(0, 4).toUpperCase();
    return prefix ? `${prefix}${shortCode}` : shortCode;
}

/**
 * Extract initials from a full name.
 * "Jean Dupont" -> "J.D."
 * "Marie Claire Legrand" -> "M.C.L."
 */
function getInitials(fullName: string): string {
    if (!fullName) return '?';

    const parts = fullName.trim().split(/\s+/);
    const initials = parts
        .map(part => part.charAt(0).toUpperCase())
        .join('.');

    return initials + '.';
}

/**
 * Anonymize a message by replacing sensitive information with
 * deterministic placeholders.
 * 
 * @param content - The original message content
 * @param context - Context with IDs and names to replace
 * @returns Anonymized message
 */
export function anonymizeMessage(content: string, context: AnonymizeContext): string {
    let result = content;

    // Replace site name with deterministic code
    if (context.siteName && context.siteId) {
        const siteCode = generateShortHash(context.siteId, 'S-');
        // Case insensitive replacement
        const siteRegex = new RegExp(escapeRegex(context.siteName), 'gi');
        result = result.replace(siteRegex, `Site #${siteCode}`);
    }

    // Replace employee name with initials
    if (context.employeeName) {
        const initials = getInitials(context.employeeName);
        const nameRegex = new RegExp(escapeRegex(context.employeeName), 'gi');
        result = result.replace(nameRegex, initials);
    }

    return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Anonymize multiple context items in a message.
 * Useful when a message might contain multiple sites or employees.
 */
export function anonymizeMessageBatch(
    content: string,
    contexts: AnonymizeContext[]
): string {
    let result = content;

    for (const ctx of contexts) {
        result = anonymizeMessage(result, ctx);
    }

    return result;
}

/**
 * Generate a preview of anonymization for UI display.
 * Returns both original and anonymized versions.
 */
export function getAnonymizationPreview(
    sampleMessage: string,
    context: AnonymizeContext
): { original: string; anonymized: string } {
    return {
        original: sampleMessage,
        anonymized: anonymizeMessage(sampleMessage, context)
    };
}

/**
 * Check if a message contains potentially sensitive data.
 * Useful for logging/debugging.
 */
export function containsSensitiveData(
    content: string,
    context: AnonymizeContext
): boolean {
    if (context.siteName && content.toLowerCase().includes(context.siteName.toLowerCase())) {
        return true;
    }
    if (context.employeeName && content.toLowerCase().includes(context.employeeName.toLowerCase())) {
        return true;
    }
    return false;
}

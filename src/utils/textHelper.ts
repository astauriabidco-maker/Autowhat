import { getTemplate, VocabularyConfig, FeatureConfig } from '../config/industryTemplates';

/**
 * Get localized text for a tenant based on:
 * 1. Custom vocabulary override (tenant.vocabulary)
 * 2. Industry template default
 * 3. Fallback to GENERIC template
 */
export function getTenantText(tenant: { industry?: string; vocabulary?: any }, key: keyof VocabularyConfig): string {
    // First, check tenant's custom vocabulary
    if (tenant.vocabulary && tenant.vocabulary[key]) {
        return tenant.vocabulary[key];
    }

    // Get industry template (default to GENERIC if not set)
    const template = getTemplate(tenant.industry || 'GENERIC');
    return template.vocabulary[key];
}

/**
 * Check if a feature is enabled for a tenant
 * Checks tenant config first, then falls back to industry defaults
 */
export function isFeatureEnabled(tenant: { industry?: string; config?: any }, feature: keyof FeatureConfig): boolean {
    // First, check tenant's custom config
    if (tenant.config && typeof tenant.config[feature] === 'boolean') {
        return tenant.config[feature];
    }

    // Get industry template default (default to GENERIC if not set)
    const template = getTemplate(tenant.industry || 'GENERIC');
    return template.config[feature];
}

/**
 * Get all vocabulary for a tenant (merged with template)
 */
export function getTenantVocabulary(tenant: { industry?: string; vocabulary?: any }): VocabularyConfig {
    const template = getTemplate(tenant.industry || 'GENERIC');

    return {
        ...template.vocabulary,
        ...(tenant.vocabulary || {})
    } as VocabularyConfig;
}

/**
 * Get all feature config for a tenant (merged with template)
 */
export function getTenantConfig(tenant: { industry?: string; config?: any }): FeatureConfig {
    const template = getTemplate(tenant.industry || 'GENERIC');

    return {
        ...template.config,
        ...(tenant.config || {})
    } as FeatureConfig;
}

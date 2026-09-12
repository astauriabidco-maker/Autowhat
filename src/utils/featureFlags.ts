function parseBooleanFlag(value: string | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

export function isFlagEnabled(name: string, defaultValue = false): boolean {
    const parsed = parseBooleanFlag(process.env[name]);
    return parsed ?? defaultValue;
}

export function isDemoMode(): boolean {
    return isFlagEnabled('DEMO_MODE', !isProduction());
}

export function allowDemoFallback(_featureFlagName: string): boolean {
    return isDemoMode();
}

export function requireFeatureEnabled(featureFlagName: string, featureLabel: string): void {
    if (isFlagEnabled(featureFlagName, !isProduction())) return;

    throw new Error(
        `${featureLabel} is disabled. Set ${featureFlagName}=true for the real integration, or DEMO_MODE=true only for demo environments.`
    );
}

export function requireDemoFallbackAllowed(featureFlagName: string, featureLabel: string): void {
    if (allowDemoFallback(featureFlagName)) return;

    throw new Error(
        `${featureLabel} demo fallback is disabled in production. Configure the real integration or set DEMO_MODE=true only for a declared demo environment.`
    );
}

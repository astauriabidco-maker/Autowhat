import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const visibleSurfaceFiles = [
    'client/src/pages/Landing.tsx',
    'client/src/pages/IntegrationWhatsApp.tsx',
    'client/src/components/landing/HeroSection.tsx',
    'client/src/components/landing/FeaturesGrid.tsx',
    'client/src/components/landing/WorkflowSection.tsx',
    'client/src/components/landing/IntegrationsSection.tsx',
    'client/src/components/landing/OperationsSection.tsx',
    'client/src/components/landing/SectorsSection.tsx',
    'client/src/pages/admin/IntegrationsManager.tsx',
    'client/src/pages/Billing.tsx',
    'client/src/pages/legal/Terms.tsx',
    'client/src/pages/legal/Privacy.tsx',
    'client/src/pages/legal/Notices.tsx',
];

const visibleLocaleFiles = [
    'client/src/locales/fr.json',
    'client/src/locales/en.json',
    'client/src/locales/es.json',
];

function collectStringValues(value: unknown): string[] {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(collectStringValues);
    if (value && typeof value === 'object') {
        return Object.values(value).flatMap(collectStringValues);
    }

    return [];
}

describe('product copy boundary', () => {
    it('does not sell retired exploitation modules on visible product surfaces', () => {
        const sourceForbidden = [
            /\bCRM\b/i,
            /\bdispatch\b/i,
            /\bdevis\b/i,
            /\bstock\b/i,
            /demande client/i,
            /support client/i,
            /rapport d['’]intervention/i,
            /demande d['’]intervention/i,
            /intervention (?:client|planifiée|terminée|à qualifier)/i,
            /technicien assigné/i,
        ];

        const localeForbidden = [
            ...sourceForbidden,
            /\bOpérations\b/i,
            /\bOperations\b/i,
            /\bOperaciones\b/i,
        ];

        const sourceOffenders = visibleSurfaceFiles.flatMap(relativePath => {
            const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
            return sourceForbidden
                .filter(pattern => pattern.test(content))
                .map(pattern => `${relativePath}: ${pattern}`);
        });

        const localeOffenders = visibleLocaleFiles.flatMap(relativePath => {
            const parsed = JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
            const values = collectStringValues(parsed).join('\n');
            return localeForbidden
                .filter(pattern => pattern.test(values))
                .map(pattern => `${relativePath}: ${pattern}`);
        });

        const offenders = [...sourceOffenders, ...localeOffenders];

        expect(offenders).toEqual([]);
    });

    it('does not sell WhatsApp BYON as a self-service white-label flow', () => {
        const whatsappSurfaceFiles = [
            'client/src/pages/IntegrationWhatsApp.tsx',
            'client/src/pages/Landing.tsx',
            'client/src/components/landing/EnterpriseSection.tsx',
            'client/src/pages/Billing.tsx',
        ];

        const forbidden = [
            /marque blanche/i,
            /connectez votre propre numéro/i,
            /embedded signup/i,
            /connecter avec facebook/i,
            /votre marque visible/i,
            /messages envoyés depuis votre numéro/i,
            /nom d['’]affichage garanti/i,
        ];

        const offenders = whatsappSurfaceFiles.flatMap(relativePath => {
            const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
            return forbidden
                .filter(pattern => pattern.test(content))
                .map(pattern => `${relativePath}: ${pattern}`);
        });

        expect(offenders).toEqual([]);
    });
});

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('product surface boundary', () => {
    it('keeps retired frontend routes away from legacy operations', () => {
        const app = read('client/src/App.tsx');

        expect(app).toContain('<Route path="/inbox" element={');
        expect(app).toContain('<ProtectedRoute><Inbox /></ProtectedRoute>');
        expect(app).toContain('<Route path="/operations/*" element={<Navigate to="/dashboard" replace />} />');
        expect(app).toContain('<Route path="/sign-intervention/:token" element={<Navigate to="/" replace />} />');
    });

    it('does not lazy-load retired operations pages in the app shell', () => {
        const app = read('client/src/App.tsx');

        [
            './pages/public/SignaturePad',
            './pages/operations/Customers',
            './pages/operations/Dispatch',
            './pages/operations/Reports',
            './pages/operations/Parts',
            './pages/operations/Recurring',
            './pages/operations/Quotes',
            './pages/operations/MapKanban',
            './pages/operations/InterventionRequests',
        ].forEach(modulePath => {
            expect(app).not.toContain(modulePath);
        });
    });

    it('keeps admin navigation centered on inbox, presence, RH, GPS and integrations', () => {
        const adminLayout = read('client/src/layouts/AdminLayout.tsx');
        const superAdminLayout = read('client/src/layouts/SuperAdminLayout.tsx');

        expect(adminLayout).toContain('/inbox');
        expect(adminLayout).toContain('Boîte de demandes');

        ['/operations', 'Dispatch', 'Devis', 'Stock', 'Récurrences', 'Demandes d\\\'intervention'].forEach(term => {
            expect(adminLayout).not.toContain(term);
        });
        expect(superAdminLayout).not.toContain('/superadmin/leads');
        expect(superAdminLayout).not.toContain('CRM Leads');
    });
});

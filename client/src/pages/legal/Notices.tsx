import { useState, useEffect } from 'react';
import axios from 'axios';
import LegalLayout from '../../layouts/LegalLayout';
import { Loader2 } from 'lucide-react';
import { companyLegalInfo, productEditorStatement } from '../../config/company';

// Default fallback content
const DEFAULT_CONTENT = `${productEditorStatement}

Éditeur
${companyLegalInfo.editorName}
${companyLegalInfo.address}

SIREN : ${companyLegalInfo.siren}
SIRET : ${companyLegalInfo.siret}

Contact
${companyLegalInfo.contactEmail}

Hébergement
${companyLegalInfo.hostingProvider}
Pays d'hébergement : ${companyLegalInfo.hostingCountry}

Service
WhatsPoint est une plateforme de pointage, présence, planning et transmission de demandes métier via WhatsApp.`;

export default function Notices() {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLegalContent = async () => {
            try {
                const res = await axios.get('/api/config/legal');
                setContent(res.data.legalNotices);
            } catch (error) {
                console.error('Error fetching legal content:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLegalContent();
    }, []);

    if (loading) {
        return (
            <LegalLayout>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-red-600" size={32} />
                </div>
            </LegalLayout>
        );
    }

    const displayContent = content || DEFAULT_CONTENT;

    return (
        <LegalLayout>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mentions Légales</h1>
            <p className="text-gray-500 mb-8">Dernière mise à jour : 29 janvier 2026</p>

            <div
                className="prose prose-gray max-w-none text-gray-600 leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}
            >
                {displayContent}
            </div>
        </LegalLayout>
    );
}

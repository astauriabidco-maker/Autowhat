import { Link } from 'react-router-dom';
import { companyLegalInfo, productEditorStatement } from '../config/company';

interface LegalLayoutProps {
    children: React.ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">W</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">WhatsPoint</span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-6 py-12">
                <article className="prose prose-slate prose-lg max-w-none">
                    {children}
                </article>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 bg-gray-50">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
                        <Link to="/legal/terms" className="hover:text-gray-900 hover:underline">
                            Conditions Générales
                        </Link>
                        <Link to="/legal/privacy" className="hover:text-gray-900 hover:underline">
                            Politique de Confidentialité
                        </Link>
                        <Link to="/legal/notices" className="hover:text-gray-900 hover:underline">
                            Mentions Légales
                        </Link>
                    </div>
                    <p className="text-center text-gray-500 text-sm mt-4">
                        © {new Date().getFullYear()} WhatsPoint. Tous droits réservés.
                    </p>
                    <p className="text-center text-gray-500 text-sm mt-2">
                        {productEditorStatement}
                    </p>
                    <p className="text-center text-gray-400 text-xs mt-2">
                        {companyLegalInfo.editorName} · SIREN {companyLegalInfo.siren} · {companyLegalInfo.address} · Hébergement {companyLegalInfo.hostingProvider}, {companyLegalInfo.hostingCountry}
                    </p>
                </div>
            </footer>
        </div>
    );
}

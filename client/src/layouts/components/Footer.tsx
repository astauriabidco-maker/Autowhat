import { Link } from 'react-router-dom';

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold text-lg">W</span>
                            </div>
                            <span className="text-2xl font-bold">whatsPoint.com</span>
                        </div>
                        <p className="text-gray-400 max-w-md">
                            Simplifiez la gestion de vos équipes avec notre solution de pointage
                            par WhatsApp. Moderne, simple, efficace.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-lg mb-4">Produit</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><Link to="/" className="hover:text-white transition">Accueil</Link></li>
                            <li><Link to="/login" className="hover:text-white transition">Connexion</Link></li>
                            <li><Link to="/register" className="hover:text-white transition">S'inscrire</Link></li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="font-semibold text-lg mb-4">Légal</h4>
                        <ul className="space-y-2 text-gray-400">
                            <li><Link to="/legal/terms" className="hover:text-white transition">Conditions Générales</Link></li>
                            <li><Link to="/legal/privacy" className="hover:text-white transition">Confidentialité</Link></li>
                            <li><Link to="/legal/notices" className="hover:text-white transition">Mentions Légales</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-gray-500 text-sm">
                        © {new Date().getFullYear()} whatsPoint.com. Tous droits réservés.
                    </p>
                    <div className="flex gap-6 text-sm text-gray-500">
                        <Link to="/legal/terms" className="hover:text-white transition">CGU</Link>
                        <Link to="/legal/privacy" className="hover:text-white transition">RGPD</Link>
                        <Link to="/legal/notices" className="hover:text-white transition">Mentions</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

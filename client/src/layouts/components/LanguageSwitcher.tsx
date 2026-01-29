import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import clsx from 'clsx';
import axios from 'axios';

interface Language {
    code: string;
    name: string;
    flag: string;
}

const languages: Language[] = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' }
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const changeLanguage = async (langCode: string) => {
        // Change UI language immediately
        i18n.changeLanguage(langCode);
        setIsOpen(false);

        // Save preference to backend (for manager)
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await axios.patch('/api/users/me',
                    { language: langCode },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } catch (error) {
            console.log('Could not save language preference to server');
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
                <span className="text-lg">{currentLanguage.flag}</span>
                <Globe size={16} className="opacity-50" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    {languages.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={clsx(
                                'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left',
                                lang.code === i18n.language && 'bg-indigo-50'
                            )}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            <span className={clsx(
                                'flex-1 text-sm',
                                lang.code === i18n.language ? 'font-semibold text-indigo-600' : 'text-gray-700'
                            )}>
                                {lang.name}
                            </span>
                            {lang.code === i18n.language && (
                                <Check size={16} className="text-indigo-600" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

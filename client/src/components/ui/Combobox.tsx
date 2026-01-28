import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface ComboboxProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    allowCreate?: boolean;
}

export default function Combobox({
    value,
    onChange,
    options,
    placeholder = 'Sélectionner...',
    allowCreate = true
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [filteredOptions, setFilteredOptions] = useState(options);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const filtered = options.filter(opt =>
            opt.toLowerCase().includes(inputValue.toLowerCase())
        );
        setFilteredOptions(filtered);
    }, [inputValue, options]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // If closed without selecting, revert to current value
                if (inputValue !== value && !allowCreate) {
                    setInputValue(value);
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputValue, value, allowCreate]);

    const handleSelect = (option: string) => {
        setInputValue(option);
        onChange(option);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setIsOpen(true);
    };

    const handleInputBlur = () => {
        // If allowCreate and there's a custom value, accept it
        if (allowCreate && inputValue && inputValue !== value) {
            onChange(inputValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]);
            } else if (allowCreate && inputValue) {
                onChange(inputValue);
                setIsOpen(false);
            }
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
            setInputValue(value);
        }
    };

    const showCreateOption = allowCreate &&
        inputValue &&
        !options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

    return (
        <div ref={wrapperRef} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(!isOpen);
                        inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                    <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => handleSelect(option)}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                            <span>{option}</span>
                            {option === value && <Check size={16} className="text-green-500" />}
                        </button>
                    ))}

                    {showCreateOption && (
                        <button
                            type="button"
                            onClick={() => handleSelect(inputValue)}
                            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 border-t border-gray-100 text-indigo-600 flex items-center gap-2"
                        >
                            <span className="font-medium">+ Créer</span>
                            <span className="text-gray-700">"{inputValue}"</span>
                        </button>
                    )}

                    {filteredOptions.length === 0 && !showCreateOption && (
                        <div className="px-4 py-3 text-gray-500 text-sm">
                            Aucun résultat
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

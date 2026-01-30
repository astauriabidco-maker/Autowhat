import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { useIsMobile } from '../hooks/useMediaQuery';

// Types
type DeviceType = 'mobile' | 'desktop';

interface VisitorState {
    countryCode: string;
    zone: string;
    currency: string;
    deviceType: DeviceType;
    trafficSource: string | null;
    isLoading: boolean;
}

interface VisitorContextType extends VisitorState {
    // Additional computed properties can be added here
    isAfricanZone: boolean;
    isPremiumZone: boolean;
}

const defaultState: VisitorState = {
    countryCode: 'FR',
    zone: 'TIER2_EUR',
    currency: 'EUR',
    deviceType: 'desktop',
    trafficSource: null,
    isLoading: true
};

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

interface VisitorProviderProps {
    children: ReactNode;
}

export function VisitorProvider({ children }: VisitorProviderProps) {
    const [state, setState] = useState<VisitorState>(defaultState);
    const isMobile = useIsMobile();

    // Update device type when isMobile changes
    useEffect(() => {
        setState(prev => ({
            ...prev,
            deviceType: isMobile ? 'mobile' : 'desktop'
        }));
    }, [isMobile]);

    // Extract traffic source from URL on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('source') || urlParams.get('utm_source');

        if (source) {
            setState(prev => ({ ...prev, trafficSource: source }));
            // Optionally store in sessionStorage for persistence
            sessionStorage.setItem('visitor_source', source);
        } else {
            // Try to recover from sessionStorage
            const storedSource = sessionStorage.getItem('visitor_source');
            if (storedSource) {
                setState(prev => ({ ...prev, trafficSource: storedSource }));
            }
        }
    }, []);

    // Fetch GeoIP data
    useEffect(() => {
        const fetchGeoData = async () => {
            try {
                const response = await axios.get('/api/public/offer');
                setState(prev => ({
                    ...prev,
                    countryCode: response.data.country || 'FR',
                    zone: response.data.zone || 'TIER2_EUR',
                    currency: response.data.currency || 'EUR',
                    isLoading: false
                }));
            } catch (error) {
                console.error('Failed to fetch GeoIP data:', error);
                setState(prev => ({
                    ...prev,
                    isLoading: false
                }));
            }
        };

        fetchGeoData();
    }, []);

    // Computed properties
    const isAfricanZone = state.zone === 'AFRICA_WEST' ||
        ['SN', 'CI', 'CM', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GN'].includes(state.countryCode);

    const isPremiumZone = state.zone === 'TIER1_USD' ||
        ['US', 'CA', 'GB', 'AU'].includes(state.countryCode);

    const value: VisitorContextType = {
        ...state,
        isAfricanZone,
        isPremiumZone
    };

    return (
        <VisitorContext.Provider value={value}>
            {children}
        </VisitorContext.Provider>
    );
}

/**
 * Hook to access visitor context
 * @throws Error if used outside VisitorProvider
 */
export function useVisitor(): VisitorContextType {
    const context = useContext(VisitorContext);
    if (context === undefined) {
        throw new Error('useVisitor must be used within a VisitorProvider');
    }
    return context;
}

/**
 * Hook to check if we're still loading visitor data
 */
export function useVisitorLoading(): boolean {
    const { isLoading } = useVisitor();
    return isLoading;
}

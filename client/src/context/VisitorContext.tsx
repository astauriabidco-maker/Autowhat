import { useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';
import { useIsMobile } from '../hooks/useMediaQuery';
import { VisitorContext, defaultVisitorState, type VisitorState, type VisitorContextType } from './visitorContextCore';

const getInitialTrafficSource = () => {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source') || urlParams.get('utm_source');

    if (source) {
        sessionStorage.setItem('visitor_source', source);
        return source;
    }

    return sessionStorage.getItem('visitor_source');
};

interface VisitorProviderProps {
    children: ReactNode;
}

export function VisitorProvider({ children }: VisitorProviderProps) {
    const [state, setState] = useState<VisitorState>(() => ({
        ...defaultVisitorState,
        trafficSource: getInitialTrafficSource()
    }));
    const isMobile = useIsMobile();

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
        deviceType: isMobile ? 'mobile' : 'desktop',
        isAfricanZone,
        isPremiumZone
    };

    return (
        <VisitorContext.Provider value={value}>
            {children}
        </VisitorContext.Provider>
    );
}

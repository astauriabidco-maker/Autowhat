import { createContext } from 'react';

export type DeviceType = 'mobile' | 'desktop';

export interface VisitorState {
    countryCode: string;
    zone: string;
    currency: string;
    deviceType: DeviceType;
    trafficSource: string | null;
    isLoading: boolean;
}

export interface VisitorContextType extends VisitorState {
    isAfricanZone: boolean;
    isPremiumZone: boolean;
}

export const defaultVisitorState: VisitorState = {
    countryCode: 'FR',
    zone: 'TIER2_EUR',
    currency: 'EUR',
    deviceType: 'desktop',
    trafficSource: null,
    isLoading: true
};

export const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

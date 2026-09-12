import { useSyncExternalStore } from 'react';

/**
 * Hook for responsive media queries
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onStoreChange) => {
            if (typeof window === 'undefined') {
                return () => {};
            }

            const mediaQuery = window.matchMedia(query);
            mediaQuery.addEventListener('change', onStoreChange);

            return () => {
                mediaQuery.removeEventListener('change', onStoreChange);
            };
        },
        () => {
            if (typeof window === 'undefined') {
                return false;
            }

            return window.matchMedia(query).matches;
        },
        () => false
    );
}

/**
 * Convenience hook for mobile detection
 * @returns true if viewport width is less than 768px
 */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 767px)');
}

/**
 * Convenience hook for tablet detection
 * @returns true if viewport width is between 768px and 1024px
 */
export function useIsTablet(): boolean {
    return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * Convenience hook for desktop detection
 * @returns true if viewport width is 1024px or more
 */
export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 1024px)');
}

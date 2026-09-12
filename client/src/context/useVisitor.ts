import { useContext } from 'react';
import { VisitorContext, type VisitorContextType } from './visitorContextCore';

export function useVisitor(): VisitorContextType {
    const context = useContext(VisitorContext);
    if (context === undefined) {
        throw new Error('useVisitor must be used within a VisitorProvider');
    }
    return context;
}

export function useVisitorLoading(): boolean {
    const { isLoading } = useVisitor();
    return isLoading;
}

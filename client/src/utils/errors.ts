import axios from 'axios';

type ApiErrorBody = {
    error?: string;
    message?: string;
    maintenanceMode?: boolean;
};

export function getErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
        return error.response?.data?.error || error.response?.data?.message || error.message || fallback;
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
}

export function getErrorStatus(error: unknown): number | undefined {
    return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export function isMaintenanceModeError(error: unknown): boolean {
    return axios.isAxiosError<ApiErrorBody>(error) && error.response?.data?.maintenanceMode === true;
}

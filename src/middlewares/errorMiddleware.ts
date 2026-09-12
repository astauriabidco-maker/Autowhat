import { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';

function isBodyParserError(error: unknown): error is { status?: number; type?: string; message?: string } {
    return Boolean(
        error
        && typeof error === 'object'
        && 'type' in error
        && typeof (error as { type?: unknown }).type === 'string'
    );
}

export const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
        return;
    }

    if (error instanceof MulterError) {
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        res.status(status).json({
            error: 'Invalid upload request',
            code: error.code
        });
        return;
    }

    if (isBodyParserError(error)) {
        const status = error.status === 413 ? 413 : 400;
        res.status(status).json({
            error: status === 413 ? 'Request body too large' : 'Invalid request body',
            code: error.type || 'INVALID_BODY'
        });
        return;
    }

    console.error('Unhandled request error:', error);
    res.status(500).json({ error: 'Internal server error' });
};

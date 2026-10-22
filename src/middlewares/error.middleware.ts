import { Request, Response, NextFunction } from 'express';

// Middleware penanganan error global
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    console.error(`[ERROR] ${err.message}`);
    res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server.',
    });
};

// Middleware untuk menangani route yang tidak ditemukan
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`,
    });
};

import { Request, Response } from 'express';

// Controller untuk endpoint utama (tes koneksi)
export const getHome = (req: Request, res: Response): void => {
    res.send('Backend GateLand berhasil menyala! 🚀');
};

// Controller untuk endpoint status API
export const getStatus = (req: Request, res: Response): void => {
    res.json({
        status: 'success',
        message: 'Sistem GateLand siap menerima perintah.',
        timestamp: new Date().toISOString(),
    });
};

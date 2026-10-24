import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodIssue } from 'zod';

// Validasi request body menggunakan Zod schema
export const validate = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                status: 'error',
                message: 'Validasi gagal.',
                errors: result.error.issues.map((e: ZodIssue) => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            });
            return;
        }

        req.body = result.data;
        next();
    };
};

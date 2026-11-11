import dotenv from 'dotenv';

dotenv.config();

const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET || 'gateland_secret_key_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
};

export default config;

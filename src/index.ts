import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import config from './config';

// Routes
import gitaRoutes from './routes/gita.routes';
import authRoutes from './routes/auth.routes';
import gateRoutes from './routes/gate.routes';
import userRoutes from './routes/user.routes';
import accessLogRoutes from './routes/accessLog.routes';
import statsRoutes from './routes/stats.routes';

// Middlewares
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO untuk real-time status gerbang ───────────────────────────────
export const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client terhubung: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client terputus: ${socket.id}`);
    });
});

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: (origin, callback) => {
        // Izinkan semua origin (localhost, IP eksternal, mobile app, Postman)
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// ─── Body Parser ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/', gitaRoutes);                          // Health check
app.use('/api/auth', authRoutes);                  // Login, Register, Me
app.use('/api/gates', gateRoutes);                 // Gate CRUD + Aksi
app.use('/api/users', userRoutes);                 // User management (Admin)
app.use('/api/access-logs', accessLogRoutes);      // Log akses
app.use('/api/stats', statsRoutes);                // Statistik dashboard

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🚀 Server GateLand berjalan di http://localhost:${config.port}`);
    console.log(`📡 Socket.IO siap untuk real-time connection`);
    console.log(`\n📋 API Endpoints:`);
    console.log(`   GET  /                         — Health check`);
    console.log(`   GET  /api/status               — Status API`);
    console.log(`   POST /api/auth/register        — Register`);
    console.log(`   POST /api/auth/login           — Login`);
    console.log(`   GET  /api/auth/me              — Profil user`);
    console.log(`   GET  /api/gates                — Semua gate`);
    console.log(`   POST /api/gates/:id/action     — Aksi gerbang`);
    console.log(`   GET  /api/access-logs          — Log akses`);
    console.log(`   GET  /api/stats                — Statistik\n`);
});

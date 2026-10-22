import express from 'express';
import config from './config';
import gitaRoutes from './routes/gita.routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

const app = express();

// Middleware agar backend bisa menerima data dalam bentuk JSON
app.use(express.json());

// Routes
app.use('/', gitaRoutes);

// Penanganan route yang tidak ditemukan
app.use(notFoundHandler);

// Penanganan error global
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Server GateLand berjalan di http://localhost:${config.port}`);
});

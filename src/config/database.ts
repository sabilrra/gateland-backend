import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';
import 'dotenv/config';

// Parse DATABASE_URL: mysql://user:pass@host:port/dbname
const url = new URL(process.env.DATABASE_URL!);

const pool = mariadb.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.replace('/', ''),
    connectionLimit: 5,
});

const adapter = new PrismaMariaDb(pool);
export const prisma = new PrismaClient({ adapter });

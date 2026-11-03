import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { io } from '../index';

// GET /api/announcements — Ambil semua riwayat pengumuman
export const getAnnouncements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            status: 'success',
            data: announcements,
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal mengambil data pengumuman.',
        });
    }
};

// POST /api/announcements — Buat pengumuman baru
export const createAnnouncement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { judul, title, kategori, category, urgensi, urgency, isi, content, lokasi, location, tanggal, eventDate, jam, eventTime, target_warga, targetWarga, authorName } = req.body;

        const announcementTitle = title || judul;
        const announcementCategory = category || kategori;
        const announcementUrgency = urgency || urgensi || 'biasa';
        const announcementContent = content || isi;
        const announcementLocation = location || lokasi || null;
        const announcementEventDate = eventDate || tanggal || null;
        const announcementEventTime = eventTime || jam || null;
        const announcementTarget = targetWarga || target_warga || 'Seluruh Warga RT 04';

        if (!announcementTitle || !announcementCategory || !announcementContent) {
            res.status(400).json({
                status: 'error',
                message: 'Judul, kategori, dan isi pengumuman wajib diisi.',
            });
            return;
        }

        // Tentukan nama author
        let resolvedAuthor = authorName || 'Admin';
        if (req.user?.id) {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { name: true },
            });
            if (user?.name) {
                resolvedAuthor = user.name;
            }
        }

        const newAnnouncement = await prisma.announcement.create({
            data: {
                title: announcementTitle,
                category: announcementCategory,
                urgency: announcementUrgency,
                content: announcementContent,
                location: announcementLocation,
                eventDate: announcementEventDate,
                eventTime: announcementEventTime,
                targetWarga: announcementTarget,
                authorName: resolvedAuthor,
            },
        });

        // Broadcast real-time jika ada client socket terhubung
        try {
            io.emit('announcement:created', newAnnouncement);
        } catch {
            // Abaikan jika socket error
        }

        res.status(201).json({
            status: 'success',
            message: 'Pengumuman berhasil diterbitkan.',
            data: newAnnouncement,
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal menerbitkan pengumuman.',
        });
    }
};


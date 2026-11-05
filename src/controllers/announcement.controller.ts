import { Request, Response } from 'express';
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

// DELETE /api/announcements/:id — Hapus pengumuman
export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params['id'] as string, 10);
        if (isNaN(id)) {
            res.status(400).json({ status: 'error', message: 'ID pengumuman tidak valid.' });
            return;
        }

        await prisma.announcement.delete({
            where: { id },
        });

        res.json({
            status: 'success',
            message: 'Pengumuman berhasil dihapus.',
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal menghapus pengumuman.',
        });
    }
};

// PUT /api/announcements/:id — Edit pengumuman
export const updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params['id'] as string, 10);
        if (isNaN(id)) {
            res.status(400).json({ status: 'error', message: 'ID pengumuman tidak valid.' });
            return;
        }

        const { title, judul, category, kategori, urgency, urgensi, content, isi, location, lokasi, eventDate, tanggal, eventTime, jam, targetWarga, target_warga } = req.body;

        const updated = await prisma.announcement.update({
            where: { id },
            data: {
                ...(title || judul ? { title: title || judul } : {}),
                ...(category || kategori ? { category: category || kategori } : {}),
                ...(urgency || urgensi ? { urgency: urgency || urgensi } : {}),
                ...(content || isi ? { content: content || isi } : {}),
                ...(location !== undefined || lokasi !== undefined ? { location: location ?? lokasi } : {}),
                ...(eventDate !== undefined || tanggal !== undefined ? { eventDate: eventDate ?? tanggal } : {}),
                ...(eventTime !== undefined || jam !== undefined ? { eventTime: eventTime ?? jam } : {}),
                ...(targetWarga !== undefined || target_warga !== undefined ? { targetWarga: targetWarga ?? target_warga } : {}),
            },
        });

        res.json({
            status: 'success',
            message: 'Pengumuman berhasil diperbarui.',
            data: updated,
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gagal memperbarui pengumuman.',
        });
    }
};



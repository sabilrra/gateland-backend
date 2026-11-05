import { Request, Response } from 'express';
import { prisma } from '../config/database';

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

// POST /api/gita/chat — AI Chatbot Assistant Gita
export const chatWithGita = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message, userName } = req.body;
        const query = (message || '').toLowerCase();
        const callerName = userName || 'Warga';

        let reply = '';

        if (query.includes('tagihan') || query.includes('iuran') || query.includes('bayar') || query.includes('ipl')) {
            reply = `Halo Bapak/Ibu ${callerName}! Tagihan iuran rutin klaster bulan ini sebesar **Rp 175.000** (Kebersihan & Keamanan). Pembayaran dapat dilakukan via **QRIS Otomatis** (langsung lunas seketika) atau **Transfer Bank Manual** di menu Tagihan pada aplikasi.`;
        } else if (query.includes('sampah') || query.includes('kebersihan')) {
            reply = `Jadwal pengangkutan sampah di lingkungan RT 04 dilakukan rutin setiap hari **Selasa, Kamis, dan Sabtu pagi** mulai pukul 08:00 WIB. Mohon letakkan tempat sampah di depan pagar sebelum jam tersebut ya! 🚛♻️`;
        } else if (query.includes('satpam') || query.includes('keamanan') || query.includes('pos') || query.includes('darurat') || query.includes('kontak')) {
            reply = `Untuk keadaan darurat atau perizinan tamu malam hari, Anda dapat menghubungi **Pos Keamanan 24 Jam (+62 811-9283-001)** atau **Sekretariat RT 04 (+62 811-9283-RT04)**. Petugas satpam kami selalu siap siaga melayani warga klaster. 👮‍♂️🛡️`;
        } else if (query.includes('gerbang') || query.includes('gate') || query.includes('portal')) {
            const gates = await prisma.gate.findMany();
            if (gates.length > 0) {
                const gateSummary = gates.map(g => `${g.name}: ${g.status}`).join(', ');
                reply = `Status gerbang saat ini: **${gateSummary}**. Akses otomatis dibuka untuk penghuni terdaftar dan tamu wajib lapor satpam pos.`;
            } else {
                reply = `Gerbang utama klaster beroperasi normal 24 jam dengan sistem pengawasan kartu RFID dan pos pantau CCTV.`;
            }
        } else if (query.includes('kegiatan') || query.includes('pengumuman') || query.includes('kerja bakti') || query.includes('agenda')) {
            const latest = await prisma.announcement.findFirst({
                orderBy: { createdAt: 'desc' }
            });
            if (latest) {
                reply = `Pengumuman terbaru dari pengurus: **"${latest.title}"**.\n\n${latest.content.slice(0, 180)}...\n\nLokasi: ${latest.location || 'Lingkungan RT 04'}. Anda juga bisa membaca detailnya di menu Notifikasi. 📢`;
            } else {
                reply = `Saat ini belum ada pengumuman kegiatan baru dari pengurus RT. Pantau terus menu Notifikasi untuk pembaruan berikutnya ya! 📋`;
            }
        } else {
            reply = `Terima kasih Bapak/Ibu ${callerName} telah menghubungi Gita. Gita siap membantu memberikan informasi terkait iuran klaster, jadwal sampah, status gerbang, kegiatan warga, dan kontak darurat RT/RW. Ada yang ingin ditanyakan lagi? 😊`;
        }

        res.json({
            status: 'success',
            data: {
                reply,
                timestamp: new Date().toISOString()
            }
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gita sedang offline sejenak.'
        });
    }
};

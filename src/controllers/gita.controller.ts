import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '../config/database';
import config from '../config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

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

interface ChatHistoryItem {
    role?: string;
    text?: string;
}

function buildRuleBasedFallback(query: string, callerName: string, billContextText: string, gateContextText: string, latestAnnouncementTitle?: string, latestAnnouncementBody?: string): string {
    const q = query.toLowerCase();
    if (q.includes('tagihan') || q.includes('iuran') || q.includes('bayar') || q.includes('ipl')) {
        return `Halo Bapak/Ibu ${callerName}! ${billContextText} Pembayaran dapat dilakukan melalui menu **Tagihan** via QRIS Otomatis maupun Transfer Bank Manual.`;
    }
    if (q.includes('sampah') || q.includes('kebersihan')) {
        return 'Jadwal pengangkutan sampah di Klaster GateLand RT 04 dilakukan rutin setiap hari **Selasa, Kamis, dan Sabtu pagi** mulai pukul **08:00 WIB**.';
    }
    if (q.includes('satpam') || q.includes('keamanan') || q.includes('pos') || q.includes('darurat') || q.includes('kontak')) {
        return 'Untuk keadaan darurat atau perizinan tamu, silakan hubungi **Pos Keamanan 24 Jam (+62 811-9283-001)** atau **Sekretariat RT 04 (+62 811-9283-RT04)**.';
    }
    if (q.includes('gerbang') || q.includes('gate') || q.includes('portal')) {
        return `Status gerbang klaster saat ini: ${gateContextText}.`;
    }
    if (q.includes('kegiatan') || q.includes('pengumuman') || q.includes('kerja bakti') || q.includes('agenda')) {
        if (latestAnnouncementTitle) {
            return `Pengumuman terbaru dari pengurus: **"${latestAnnouncementTitle}"**.\n\n${latestAnnouncementBody || ''}`;
        }
        return 'Saat ini belum ada pengumuman terbaru dari pengurus RT.';
    }
    return `Halo Bapak/Ibu ${callerName}! ${billContextText} Ada hal lain seputar GateLand yang bisa Gita bantu?`;
}

// POST /api/gita/chat — AI Chatbot Assistant Gita (terintegrasi Gemini API)
export const chatWithGita = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const rawMessage = String(req.body?.message || '').trim();
        let callerName = String(req.body?.userName || 'Warga').trim() || 'Warga';
        const rawHistory: ChatHistoryItem[] = Array.isArray(req.body?.history) ? req.body.history : [];

        if (!rawMessage) {
            res.status(400).json({
                status: 'error',
                message: 'Pesan tidak boleh kosong.',
            });
            return;
        }

        // 1. Ambil data pribadi user, tagihan, dan transaksi dari MySQL jika user sedang login
        let userContextText = `Nama warga: ${callerName} (sesi tamu / belum mengirim token login).`;
        let billContextText = 'User belum login sehingga rincian tagihan pribadi belum dapat diakses.';
        let transactionContextText = 'Belum ada data transaksi pribadi.';

        if (req.user?.id) {
            const [user, bills, transactions] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: {
                        name: true,
                        email: true,
                        whatsapp: true,
                        address: true,
                        isVerified: true,
                        nik: true,
                        birthPlaceDate: true,
                        residencyStatus: true,
                        familyCount: true,
                        rwArea: true,
                        occupancyStatus: true,
                        ownershipType: true,
                        powerWater: true,
                        vehicles: true,
                    },
                }),
                prisma.bill.findMany({
                    where: { userId: req.user.id },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.transaction.findMany({
                    where: { userId: req.user.id },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                }),
            ]);

            if (user) {
                callerName = user.name;
                userContextText = [
                    `Nama: ${user.name}`,
                    `Email: ${user.email}`,
                    `WhatsApp: ${user.whatsapp || 'Belum diisi'}`,
                    `Blok / Unit Rumah: ${user.address || 'Belum diisi'}`,
                    `Wilayah RW: ${user.rwArea || 'Belum diisi'}`,
                    `Status Verifikasi Admin: ${user.isVerified ? 'Terverifikasi (Aktif)' : 'Menunggu Verifikasi Admin'}`,
                    `Status Kependudukan: ${user.residencyStatus || 'Belum diisi'}`,
                    `Status Penghuni / Kepemilikan: ${user.occupancyStatus || user.ownershipType || 'Belum diisi'}`,
                    `Jumlah Anggota Keluarga: ${user.familyCount || 'Belum diisi'}`,
                    `Kendaraan Terdaftar: ${user.vehicles || 'Belum diisi'}`,
                ].join('\n- ');
            }

            const unpaidBills = bills.filter((b) => b.status === 'UNPAID');
            const paidBills = bills.filter((b) => b.status === 'PAID');
            const totalUnpaid = unpaidBills.reduce((sum, b) => sum + b.amount, 0);

            if (unpaidBills.length > 0) {
                const rincian = unpaidBills
                    .map((b) => `${b.month} (Rp ${b.amount.toLocaleString('id-ID')}, jatuh tempo ${b.dueDate || '-'})`)
                    .join('; ');
                billContextText = `Terdapat ${unpaidBills.length} tagihan belum dibayar dengan total Rp ${totalUnpaid.toLocaleString('id-ID')}: ${rincian}. Tagihan berstatus LUNAS: ${paidBills.length}.`;
            } else {
                billContextText = `Total tagihan aktif saat ini adalah Rp 0 (belum ada tagihan aktif / tidak ada tunggakan). Jumlah tagihan yang sudah lunas: ${paidBills.length}.`;
            }

            if (transactions.length > 0) {
                transactionContextText = transactions
                    .map((t) => `${t.id}: Rp ${t.amount.toLocaleString('id-ID')} via ${t.paymentChannel} [${t.status}]`)
                    .join('; ');
            }
        }

        // 2. Ambil data umum klaster (gerbang & pengumuman terbaru)
        const [gates, announcements] = await Promise.all([
            prisma.gate.findMany(),
            prisma.announcement.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);

        const gateContextText = gates.length > 0
            ? gates.map((g) => `${g.name} (${g.location}): ${g.status}`).join(' | ')
            : 'Gerbang utama beroperasi normal 24 jam.';

        const announcementContextText = announcements.length > 0
            ? announcements
                .map(
                    (a, i) =>
                        `${i + 1}. "${a.title}" [Kategori: ${a.category}, Urgensi: ${a.urgency}] - ${a.content.slice(0, 180)} (Lokasi: ${a.location || 'Klaster GateLand'}, Tanggal: ${a.eventDate || '-'})`
                )
                .join('\n')
            : 'Belum ada pengumuman terbaru dari pengurus.';

        // 3. Susun System Instruction untuk Gemini AI
        const systemInstruction = `
Kamu adalah **Gita**, asisten virtual cerdas resmi perumahan **Klaster GateLand (RT 04 / RW 08)**.
Jawablah pertanyaan warga menggunakan Bahasa Indonesia yang ramah, sopan, hangat, singkat, dan langsung menjawab inti pertanyaan.

ATURAN PENTING:
1. Jawab berdasarkan DATA NYATA di bawah ini dan fitur aplikasi GateLand.
2. DILARANG mengarang nominal tagihan, jadwal, atau pengumuman jika tidak tertulis di data. Jika warga memiliki tagihan Rp 0, sampaikan dengan jelas bahwa total tagihannya adalah Rp 0.
3. Jika pengguna menanyakan data yang belum diisi di profilnya (tertulis "Belum diisi"), sarankan mereka melengkapinya lewat menu **Profil -> Edit Profil**.
4. Kamu boleh menggunakan format **tebal** (bold dengan tanda bintang ganda) untuk angka penting atau nama menu agar mudah dibaca di aplikasi mobile.

DATA WARGA YANG SEDANG BERTANYA:
- ${userContextText}

STATUS TAGIHAN PRIBADI WARGA:
${billContextText}

RIWAYAT TRANSAKSI TERAKHIR WARGA:
${transactionContextText}

STATUS GERBANG KLASTER:
${gateContextText}

PENGUMUMAN TERBARU DARI PENGURUS:
${announcementContextText}

PANDUAN FITUR & INFO TETAP KLASTER GATELAND:
- Pembayaran iuran: Buka menu **Tagihan**, pilih tagihan aktif, lalu pilih **QRIS Otomatis** (langsung lunas otomatis setelah dibayar) atau **Transfer Bank Manual** (upload/kirim konfirmasi transfer untuk diverifikasi admin).
- Ubah data pribadi, hunian, kepemilikan, kendaraan, atau foto profil: Buka ikon profil di kanan atas Beranda -> **Edit Profil**.
- Ubah kata sandi / lupa kata sandi: Mendukung pengiriman kode OTP ke **WhatsApp** maupun **Email** terdaftar.
- Jadwal angkut sampah rutin: **Selasa, Kamis, dan Sabtu** pagi pukul **08:00 WIB**.
- Kontak darurat: **Pos Keamanan 24 Jam (+62 811-9283-001)** dan **Sekretariat RT 04 (+62 811-9283-RT04)**.
`.trim();

        // 4. Siapkan riwayat percakapan (maks 8 pesan terakhir sebelum pesan saat ini)
        const historyContents = rawHistory
            .filter((item) => item && typeof item.text === 'string' && item.text.trim().length > 0)
            .slice(-8)
            .map((item) => ({
                role: item.role === 'model' ? ('model' as const) : ('user' as const),
                parts: [{ text: String(item.text).trim() }],
            }));

        const contents = [
            ...historyContents,
            {
                role: 'user' as const,
                parts: [{ text: rawMessage }],
            },
        ];

        // 5. Panggil Gemini API dengan timeout tegas agar tidak menggantung lama
        let reply = '';
        let source: 'gemini' | 'fallback' = 'fallback';
        let usedModel = config.geminiModel;

        if (config.geminiApiKey) {
            const ai = new GoogleGenAI({
                apiKey: config.geminiApiKey,
                httpOptions: { timeout: 12000 },
            });
            const candidateModels = Array.from(
                new Set([
                    config.geminiModel,
                    'gemini-3.5-flash-lite',
                    'gemini-3.5-flash',
                    'gemini-3.7-flash',
                ])
            );

            for (const modelName of candidateModels) {
                const startMs = Date.now();
                try {
                    const aiResponse = await Promise.race([
                        ai.models.generateContent({
                            model: modelName,
                            contents,
                            config: {
                                systemInstruction,
                                temperature: 0.4,
                            },
                        }),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`Timeout > 12s pada model ${modelName}`)), 12000)
                        ),
                    ]);
                    const aiText = aiResponse.text?.trim();
                    if (aiText) {
                        reply = aiText;
                        source = 'gemini';
                        usedModel = modelName;
                        console.log(`[Gita Gemini OK] Model ${modelName} merespons dalam ${Date.now() - startMs}ms`);
                        break;
                    }
                } catch (aiError: any) {
                    const status = aiError?.status || aiError?.code || 'timeout';
                    console.warn(`[Gita Gemini Warn] Model ${modelName} gagal (${status}, ${Date.now() - startMs}ms):`, aiError?.message || aiError);
                }
            }
        }

        if (!reply) {
            reply = buildRuleBasedFallback(
                rawMessage,
                callerName,
                billContextText,
                gateContextText,
                announcements[0]?.title,
                announcements[0]?.content
            );
        }

        res.json({
            status: 'success',
            data: {
                reply,
                source,
                model: source === 'gemini' ? usedModel : 'fallback',
                timestamp: new Date().toISOString(),
            },
        });
    } catch (err: any) {
        res.status(500).json({
            status: 'error',
            message: err.message || 'Gita sedang offline sejenak.',
        });
    }
};

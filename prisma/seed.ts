import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database';

async function main() {
    console.log('🌱 Memulai proses seeding database Gateland...');

    // 1. Password hash default untuk admin: "Admin123-" (memenuhi syarat huruf besar, angka, simbol)
    const adminHashedPassword = await bcrypt.hash('Admin123-', 12);
    // Password hash default untuk user/guard: "password123"
    const userHashedPassword = await bcrypt.hash('password123', 12);

    // 2. Buat User Awal
    console.log('👤 Membuat user awal (Admin, Guard, Warga)...');
    
    // Admin (khusus untuk Website Admin, backend memvalidasi wajib admin@gmail.com)
    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: { password: adminHashedPassword, role: 'ADMIN' },
        create: {
            name: 'Admin Gateland',
            email: 'admin@gmail.com',
            password: adminHashedPassword,
            role: 'ADMIN',
        },
    });

    // Guard / Satpam (untuk Mobile App)
    const guard = await prisma.user.upsert({
        where: { email: 'guard@gmail.com' },
        update: { password: userHashedPassword, role: 'GUARD' },
        create: {
            name: 'Budi Santoso (Satpam)',
            email: 'guard@gmail.com',
            password: userHashedPassword,
            role: 'GUARD',
        },
    });

    // Warga / Resident (untuk Mobile App)
    const resident = await prisma.user.upsert({
        where: { email: 'sabila@gmail.com' },
        update: { password: userHashedPassword, role: 'USER' },
        create: {
            name: 'Sabila Aulia',
            email: 'sabila@gmail.com',
            password: userHashedPassword,
            role: 'USER',
        },
    });

    console.log(`✅ Users siap: Admin (${admin.email}), Guard (${guard.email}), Warga (${resident.email})`);

    // 3. Buat Gate Awal
    console.log('🚧 Membuat data Gerbang / Gates...');
    const existingGates = await prisma.gate.count();
    let gate1, gate2, gate3;

    if (existingGates === 0) {
        gate1 = await prisma.gate.create({
            data: {
                name: 'Gerbang Utama (Blok A)',
                location: 'Akses Masuk Depan',
                status: 'OPEN',
            },
        });

        gate2 = await prisma.gate.create({
            data: {
                name: 'Gerbang Belakang (Blok C)',
                location: 'Akses Keluar Perumahan',
                status: 'CLOSED',
            },
        });

        gate3 = await prisma.gate.create({
            data: {
                name: 'Pintu Gerbang Timur',
                location: 'Samping Pos Satpam 2',
                status: 'MAINTENANCE',
            },
        });
        console.log('✅ Gates berhasil dibuat.');
    } else {
        gate1 = await prisma.gate.findFirst();
        console.log('ℹ️ Gates sudah ada sebelumnya.');
    }

    // 4. Buat Access Logs awal agar statistik website terisi
    console.log('📋 Membuat log aktivitas akses gerbang...');
    const existingLogs = await prisma.accessLog.count();
    if (existingLogs === 0 && gate1) {
        await prisma.accessLog.createMany({
            data: [
                {
                    userId: resident.id,
                    gateId: gate1.id,
                    action: 'OPEN',
                    timestamp: new Date(Date.now() - 3600000 * 2), // 2 jam lalu
                },
                {
                    userId: resident.id,
                    gateId: gate1.id,
                    action: 'CLOSE',
                    timestamp: new Date(Date.now() - 3600000 * 1), // 1 jam lalu
                },
                {
                    userId: guard.id,
                    gateId: gate1.id,
                    action: 'OPEN',
                    timestamp: new Date(Date.now() - 1800000), // 30 menit lalu
                },
            ],
        });
        console.log('✅ Access Logs berhasil dibuat.');
    }

    // 5. Buat Pengumuman Awal
    console.log('📢 Membuat pengumuman awal...');
    const existingAnnouncements = await prisma.announcement.count();
    if (existingAnnouncements === 0) {
        await prisma.announcement.createMany({
            data: [
                {
                    title: 'Kerja Bakti Lingkungan Perumahan',
                    category: 'Kegiatan Warga',
                    urgency: 'penting',
                    content: 'Dihimbau kepada seluruh warga RT 04 untuk mengikuti kegiatan kerja bakti dan pembersihan drainase bersama pada hari Minggu pagi.',
                    location: 'Area Fasum Blok B',
                    eventDate: 'Minggu, 10 November 2026',
                    eventTime: '07:30 - Selesai',
                    targetWarga: 'Seluruh Warga RT 04',
                    authorName: 'Ketua RT 04',
                },
                {
                    title: 'Pemberitahuan Pemeliharaan Lampu Jalan',
                    category: 'Fasilitas',
                    urgency: 'biasa',
                    content: 'Akan dilakukan pergantian lampu jalan di sepanjang Blok C pada hari Selasa malam. Mohon berhati-hati saat melintas.',
                    location: 'Jalan Utama Blok C',
                    eventDate: 'Selasa, 12 November 2026',
                    eventTime: '20:00 - 22:00',
                    targetWarga: 'Warga Blok C',
                    authorName: 'Admin Gateland',
                },
            ],
        });
        console.log('✅ Announcements berhasil dibuat.');
    }

    // 6. Buat Tagihan / Bill Awal
    console.log('💳 Membuat tagihan iuran awal...');
    const existingBills = await prisma.bill.count();
    if (existingBills === 0) {
        await prisma.bill.create({
            data: {
                userId: resident.id,
                residentName: resident.name,
                unit: 'Unit 1',
                month: 'Agustus 2026',
                amount: 175000,
                status: 'UNPAID',
                dueDate: '10 Agustus 2026',
            },
        });
        console.log('✅ Tagihan berhasil dibuat.');
    }

    console.log('✨ Seeding selesai dengan sukses!');
    process.exit(0);
}

main()
    .catch((e) => {
        console.error('❌ Terjadi kesalahan saat seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

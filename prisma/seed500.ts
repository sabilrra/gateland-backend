import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database';

// Daftar nama warga perumahan realistis Indonesia
const namaDepan = [
  'Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Galih', 'Hani',
  'Irfan', 'Joko', 'Kartika', 'Luthfi', 'Maya', 'Naufal', 'Oktavia',
  'Prita', 'Qori', 'Reza', 'Sari', 'Tono', 'Ulfa', 'Vino', 'Wati',
  'Xenia', 'Yudi', 'Zahra', 'Agus', 'Bagas', 'Cindy', 'Dani',
  'Endah', 'Fajar', 'Gita', 'Hendra', 'Indra', 'Julia', 'Kevin',
  'Laila', 'Miko', 'Nina', 'Oscar', 'Putri', 'Qila', 'Rizky',
  'Sinta', 'Taufik', 'Umar', 'Vera', 'Wahyu', 'Yani',
];

const namaBelakang = [
  'Santoso', 'Rahayu', 'Wijaya', 'Kusuma', 'Susanto', 'Hidayat',
  'Nugroho', 'Pratama', 'Sari', 'Wibowo', 'Halim', 'Gunawan',
  'Setiawan', 'Putra', 'Lestari', 'Hasan', 'Mulyadi', 'Firmansyah',
  'Purnama', 'Cahyadi', 'Handoko', 'Siregar', 'Nasution', 'Lubis',
  'Sitorus', 'Manalu', 'Simbolon', 'Nainggolan', 'Panjaitan',
];

const blok = ['A', 'B', 'C', 'D', 'E'];
const rwArea = ['RW 01', 'RW 02', 'RW 03'];
const occupancyStatus = ['Pemilik Rumah', 'Penyewa / Kontrak'];
const ownershipType = ['Hak Milik', 'KPR', 'Sewa'];
const powerWater = ['900 VA', '1300 VA', '2200 VA', '3500 VA'];
const months = [
  'Januari 2026', 'Februari 2026', 'Maret 2026', 'April 2026',
  'Mei 2026', 'Juni 2026', 'Juli 2026', 'Agustus 2026',
  'September 2026', 'Oktober 2026',
];
const billStatusList: Array<'UNPAID' | 'PAID'> = ['UNPAID', 'PAID'];
const announcementCategories = ['Keamanan', 'Kebersihan', 'Fasilitas', 'Kegiatan Warga', 'Keuangan', 'Kesehatan'];
const announcementUrgency = ['penting', 'biasa'];
const gateActions: Array<'OPEN' | 'CLOSE' | 'DENIED'> = ['OPEN', 'CLOSE', 'DENIED'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysAgo));
  d.setHours(randomInt(0, 23), randomInt(0, 59));
  return d;
}

function generateNIK(index: number): string {
  return `3273${String(index).padStart(10, '0')}`;
}

function generateWA(index: number): string {
  return `0812${String(index + 10000000).slice(1)}`;
}

async function main() {
  console.log('🌱 Memulai seeding 500 data dummy GateLand...\n');

  const defaultPassword = await bcrypt.hash('password123', 10);

  // Pastikan gate tersedia
  let gateAll = await prisma.gate.findMany();
  if (gateAll.length === 0) {
    await prisma.gate.createMany({
      data: [
        { name: 'Gerbang Utama (Blok A)', location: 'Akses Masuk Depan', status: 'OPEN' },
        { name: 'Gerbang Belakang (Blok C)', location: 'Akses Keluar Perumahan', status: 'CLOSED' },
        { name: 'Pintu Gerbang Timur', location: 'Samping Pos Satpam 2', status: 'MAINTENANCE' },
      ],
    });
    gateAll = await prisma.gate.findMany();
    console.log('✅ Gates dibuat.');
  }

  // ─── 1. BUAT 150 USER WARGA ───────────────────────────────────────────
  console.log('👥 Membuat 150 warga...');
  const userIds: number[] = [];
  const userAddresses: string[] = [];

  for (let i = 1; i <= 150; i++) {
    const nama = `${randomItem(namaDepan)} ${randomItem(namaBelakang)}`;
    const blokChar = randomItem(blok);
    const unitNo = randomInt(1, 20);
    const address = `Blok ${blokChar}${unitNo} Unit ${unitNo}`;
    const email = `warga${i}@gateland.test`;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      userIds.push(existing.id);
      userAddresses.push(existing.address ?? address);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: nama,
        email,
        password: defaultPassword,
        role: 'USER',
        isVerified: true,
        whatsapp: generateWA(i),
        address,
        nik: generateNIK(i),
        birthPlaceDate: `Jakarta, ${randomInt(1, 28)}/${randomInt(1, 12)}/${randomInt(1970, 2000)}`,
        residencyStatus: 'WNI',
        familyCount: String(randomInt(2, 6)),
        emergencyContactName: `${randomItem(namaDepan)} ${randomItem(namaBelakang)}`,
        emergencyContactPhone: generateWA(i + 500),
        rwArea: randomItem(rwArea),
        occupancyStatus: randomItem(occupancyStatus),
        ownershipType: randomItem(ownershipType),
        powerWater: randomItem(powerWater),
        vehicles: randomInt(0, 1) === 1 ? 'Motor' : 'Motor, Mobil',
      },
    });
    userIds.push(user.id);
    userAddresses.push(address);
  }
  console.log(`✅ ${userIds.length} warga siap.\n`);

  // ─── 2. BUAT 200 TAGIHAN (BILLS) ─────────────────────────────────────
  console.log('💳 Membuat 200 tagihan iuran...');
  const billIds: number[] = [];
  const billData: Array<{ id: number; userId: number; status: 'UNPAID' | 'PAID'; amount: number; residentName: string; unit: string }> = [];

  for (let i = 0; i < 200; i++) {
    const idx = i % userIds.length;
    const userId = userIds[idx];
    const unit = userAddresses[idx];
    const month = randomItem(months);
    const status: 'UNPAID' | 'PAID' = i < 80 ? 'UNPAID' : 'PAID';
    const amount = randomItem([150000, 175000, 200000, 250000]);
    const dueMonthNum = months.indexOf(month) + 1;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const bill = await prisma.bill.create({
      data: {
        userId,
        residentName: user?.name ?? 'Warga GateLand',
        unit,
        month,
        amount,
        status,
        dueDate: `${randomInt(5, 15)} ${month}`,
        description: `Iuran bulanan warga perumahan GateLand periode ${month}. Termasuk biaya keamanan dan kebersihan lingkungan.`,
      },
    });
    billIds.push(bill.id);
    billData.push({ id: bill.id, userId, status, amount, residentName: user?.name ?? '', unit });
  }
  console.log(`✅ ${billIds.length} tagihan siap.\n`);

  // ─── 3. BUAT 150 TRANSAKSI ────────────────────────────────────────────
  console.log('💰 Membuat 150 transaksi pembayaran...');
  const paidBills = billData.filter(b => b.status === 'PAID');
  const txChannels = ['QRIS', 'Transfer Bank'];
  const txStatuses: Array<'SETTLEMENT' | 'PENDING' | 'FAILED' | 'EXPIRED'> = ['SETTLEMENT', 'PENDING', 'FAILED', 'EXPIRED'];

  for (let i = 0; i < 150; i++) {
    const bill = paidBills[i % paidBills.length];
    const channel = randomItem(txChannels);
    const txStatus = i < 100 ? 'SETTLEMENT' : randomItem(txStatuses);
    const paidAt = txStatus === 'SETTLEMENT' ? randomDate(90) : null;

    await prisma.transaction.create({
      data: {
        billId: bill.id,
        userId: bill.userId,
        residentName: bill.residentName,
        unit: bill.unit,
        amount: bill.amount,
        paymentChannel: channel,
        status: txStatus,
        proofUrl: channel === 'Transfer Bank' ? `https://storage.gateland.app/bukti/tx${i + 1}.jpg` : null,
        paidAt,
        createdAt: randomDate(120),
      },
    });
  }
  console.log('✅ 150 transaksi siap.\n');

  // ─── 4. BUAT 50 PENGUMUMAN ────────────────────────────────────────────
  console.log('📢 Membuat 50 pengumuman...');
  const announcementTitles = [
    'Kerja Bakti Lingkungan', 'Jadwal Ronda Malam Blok %B', 'Perbaikan Pipa Air',
    'Rapat RT Bulanan', 'Turnamen Olahraga Warga', 'Pemadaman Listrik Terjadwal',
    'Vaksinasi Gratis Warga', 'Pembersihan Saluran Drainase', 'Penyemprotan Fogging DBD',
    'Pembayaran Iuran Kebersihan', 'Penutupan Jalan Sementara', 'Festival Perumahan GateLand',
    'Pemeliharaan Lampu Jalan', 'Sosialisasi Keamanan', 'Gotong Royong Taman',
  ];

  const existingAnnouncements = await prisma.announcement.count();
  if (existingAnnouncements < 10) {
    for (let i = 1; i <= 50; i++) {
      const blokChar = randomItem(blok);
      const title = randomItem(announcementTitles).replace('%B', blokChar);
      const category = randomItem(announcementCategories);
      const urgency = randomItem(announcementUrgency);
      const eventDay = randomInt(1, 28);
      const eventMonth = randomItem(months);

      await prisma.announcement.create({
        data: {
          title: `${title} ${i}`,
          category,
          urgency,
          content: `Kepada seluruh warga perumahan GateLand, kami mengumumkan kegiatan "${title}" yang akan dilaksanakan di area perumahan. Mohon partisipasi aktif dari seluruh warga demi kenyamanan dan keamanan bersama. Kehadiran sangat diharapkan.`,
          location: `Area Fasum Blok ${blokChar}`,
          eventDate: `${eventDay} ${eventMonth}`,
          eventTime: `${randomInt(7, 14)}:00 WIB`,
          targetWarga: `Warga Blok ${blokChar}`,
          authorName: randomInt(0, 1) === 0 ? 'Admin GateLand' : `Ketua RT 0${randomInt(1, 5)}`,
          createdAt: randomDate(180),
        },
      });
    }
    console.log('✅ 50 pengumuman siap.\n');
  } else {
    console.log('ℹ️ Pengumuman sudah cukup, dilewati.\n');
  }

  // ─── 5. BUAT 100 ACCESS LOGS ─────────────────────────────────────────
  console.log('🚪 Membuat 100 log akses gerbang...');
  for (let i = 0; i < 100; i++) {
    const userId = randomItem(userIds);
    const gate = randomItem(gateAll);
    await prisma.accessLog.create({
      data: {
        userId,
        gateId: gate.id,
        action: randomItem(gateActions),
        timestamp: randomDate(60),
      },
    });
  }
  console.log('✅ 100 access log siap.\n');

  // ─── RINGKASAN ────────────────────────────────────────────────────────
  const totalUsers = await prisma.user.count();
  const totalBills = await prisma.bill.count();
  const totalTx = await prisma.transaction.count();
  const totalAnnouncements = await prisma.announcement.count();
  const totalLogs = await prisma.accessLog.count();

  console.log('═══════════════════════════════════════════════');
  console.log('✨ SEEDING 500 DATA SELESAI!');
  console.log('═══════════════════════════════════════════════');
  console.log(`👥 Total User      : ${totalUsers}`);
  console.log(`💳 Total Tagihan   : ${totalBills}`);
  console.log(`💰 Total Transaksi : ${totalTx}`);
  console.log(`📢 Total Pengumuman: ${totalAnnouncements}`);
  console.log(`🚪 Total Log Akses : ${totalLogs}`);
  console.log('═══════════════════════════════════════════════');

  process.exit(0);
}

main()
  .catch((e) => {
    console.error('❌ Error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

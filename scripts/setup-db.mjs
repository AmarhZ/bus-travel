// Membuat tabel, akun admin, pengaturan awal, dan (opsional) data contoh.
// Jalankan:  npm run db:setup        -> tabel + admin + pengaturan
//            npm run db:seed         -> sama, ditambah data contoh bus/rute/jadwal
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diatur. Isi di file .env.local (lihat .env.example).');
  process.exit(1);
}
const sql = neon(url);
const q = (text, params = []) => sql.query(text, params);
const TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Jakarta';

async function main() {
  const schema = readFileSync(join(here, '..', 'db', 'schema.sql'), 'utf8');
  const statements = schema
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) await q(st);
  console.log(`✔ ${statements.length} pernyataan skema dijalankan`);

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  const existing = await q('SELECT id FROM admins WHERE username = $1', [username]);
  if (existing.length === 0) {
    if (!password || password.length < 8) {
      console.error('ADMIN_PASSWORD wajib diisi (minimal 8 karakter) untuk membuat akun admin pertama.');
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);
    await q('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [username, hash]);
    console.log(`✔ Akun admin "${username}" dibuat`);
  } else {
    console.log(`• Akun admin "${username}" sudah ada (tidak diubah)`);
  }

  const defaults = {
    company_name: 'Nusantara Trans',
    tagline: 'Naik bus antarkota, pesan kursi dari rumah.',
    contact_phone: '021-5550-1234',
    whatsapp: '6281234567890',
    contact_email: 'halo@nusantaratrans.example',
    address: 'Terminal Utama, Jl. Raya Terminal No. 1',
    payment_expiry_minutes: '120',
    max_seats_per_booking: '6',
    payment_instructions:
      'Transfer Bank: BCA 1234567890 a.n. Nusantara Trans\nTransfer Bank: Mandiri 9876543210 a.n. Nusantara Trans\nE-Wallet: 0812-3456-7890 (DANA / OVO / GoPay)\nQRIS: tunjukkan QRIS di loket atau minta gambar QRIS via WhatsApp.',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }
  console.log('✔ Pengaturan awal siap');

  if (process.argv.includes('--seed')) await seed();
  console.log('Selesai.');
}

async function seed() {
  const [{ n }] = await q('SELECT count(*)::int AS n FROM buses');
  if (n > 0) {
    console.log('• Data contoh dilewati (tabel bus sudah berisi data)');
    return;
  }
  const buses = [
    ['Nusantara Prima 01', 'B 7001 NT', 'Eksekutif', 32, '2-2', 'AC, Reclining seat, Toilet, USB charger, Selimut'],
    ['Nusantara Prima 02', 'B 7002 NT', 'Eksekutif', 32, '2-2', 'AC, Reclining seat, Toilet, USB charger, Selimut'],
    ['Nusantara Royal 03', 'B 7003 NT', 'Sleeper', 20, '2-1', 'AC, Seat sleeper, Toilet, Wi-Fi, Snack'],
    ['Nusantara Ekonomi 04', 'B 7004 NT', 'Ekonomi', 40, '2-2', 'AC, Bagasi luas'],
  ];
  for (const b of buses) {
    await q(
      'INSERT INTO buses (name, plate, bus_class, capacity, seat_layout, facilities) VALUES ($1,$2,$3,$4,$5,$6)',
      b,
    );
  }
  const routes = [
    ['Jakarta', 'Bandung', 'Terminal Pulo Gebang', 'Terminal Leuwipanjang', 150, 210],
    ['Bandung', 'Jakarta', 'Terminal Leuwipanjang', 'Terminal Pulo Gebang', 150, 210],
    ['Jakarta', 'Semarang', 'Terminal Pulo Gebang', 'Terminal Terboyo', 450, 480],
    ['Semarang', 'Surabaya', 'Terminal Terboyo', 'Terminal Purabaya', 350, 420],
    ['Jakarta', 'Yogyakarta', 'Terminal Pulo Gebang', 'Terminal Giwangan', 560, 600],
  ];
  for (const r of routes) {
    await q(
      'INSERT INTO routes (origin, destination, boarding_point, dropoff_point, distance_km, duration_min) VALUES ($1,$2,$3,$4,$5,$6)',
      r,
    );
  }
  const prices = { 1: 150000, 2: 150000, 3: 260000, 4: 230000, 5: 320000 };
  const times = ['07:00', '13:00', '20:00'];
  // 14 hari ke depan, mulai besok, jam lokal sesuai NEXT_PUBLIC_TIMEZONE
  for (let day = 1; day <= 14; day++) {
    for (let i = 0; i < routes.length; i++) {
      const routeId = i + 1;
      const time = times[(i + day) % times.length];
      const busId = ((i + day) % 4) + 1;
      await q(
        `INSERT INTO schedules (route_id, bus_id, departure_at, price)
         VALUES ($1, $2, ((current_date + $3::int)::text || ' ' || $4)::timestamp AT TIME ZONE $5, $6)`,
        [routeId, busId, day, time, TZ, prices[routeId]],
      );
    }
  }
  console.log('✔ Data contoh dibuat: 4 bus, 5 rute, 70 jadwal');
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});

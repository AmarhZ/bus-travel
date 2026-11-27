import { query, one } from './db';
import { HttpError } from './api';
import { getSettings } from './settings';
import { normalizePhone } from './format';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Jumlah maksimal pemesanan "menunggu pembayaran" per nomor HP (pemesanan online). */
export const MAX_PENDING_PER_PHONE = 3;

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = 'BT';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

/**
 * Pemesanan pending yang lewat batas waktu ditandai kedaluwarsa dan kursinya dilepas.
 * Pemesanan yang pembayarannya sudah dikirim (menunggu verifikasi admin) tidak ikut kedaluwarsa.
 */
export async function expireStale() {
  await query(`
    WITH e AS (
      UPDATE bookings SET status = 'expired'
      WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = bookings.id AND p.status = 'submitted')
      RETURNING id
    ), d AS (
      DELETE FROM booking_seats WHERE booking_id IN (SELECT id FROM e) RETURNING 1
    ), p AS (
      UPDATE payments SET status = 'failed' WHERE booking_id IN (SELECT id FROM e) RETURNING 1
    )
    SELECT count(*)::int AS n FROM e
  `);
}

export async function getTakenSeats(scheduleId) {
  const rows = await query('SELECT seat_number FROM booking_seats WHERE schedule_id = $1 ORDER BY seat_number', [
    scheduleId,
  ]);
  return rows.map((r) => r.seat_number);
}

export function validateContact({ customerName, phone, email }) {
  const name = String(customerName || '').trim();
  const ph = String(phone || '').trim();
  const mail = String(email || '').trim();
  if (name.length < 2) throw new HttpError(400, 'Nama pemesan wajib diisi.');
  if (name.length > 100) throw new HttpError(400, 'Nama pemesan terlalu panjang.');
  const digits = normalizePhone(ph);
  if (digits.length < 9 || digits.length > 15) throw new HttpError(400, 'Nomor HP tidak valid.');
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new HttpError(400, 'Format email tidak valid.');
  return { name, phone: ph, email: mail };
}

/**
 * Buat pemesanan + pembayaran + kursi dalam SATU pernyataan SQL (atomik).
 * Kursi ganda ditolak oleh UNIQUE (schedule_id, seat_number).
 * paid=true dipakai untuk penjualan di loket (langsung lunas).
 */
export async function createBooking({ scheduleId, customerName, phone, email, seats, method, paid = false }) {
  const contact = validateContact({ customerName, phone, email });
  const settings = await getSettings();
  const maxSeats = Math.max(1, parseInt(settings.max_seats_per_booking, 10) || 6);
  const expiryMin = Math.max(10, parseInt(settings.payment_expiry_minutes, 10) || 120);

  if (!['transfer', 'qris', 'ewallet', 'cash'].includes(method)) {
    throw new HttpError(400, 'Metode pembayaran tidak valid.');
  }
  if (!Array.isArray(seats) || seats.length === 0) throw new HttpError(400, 'Pilih minimal satu kursi.');
  if (seats.length > maxSeats) throw new HttpError(400, `Maksimal ${maxSeats} kursi per pemesanan.`);

  await expireStale();

  // Pemesanan online: satu nomor HP hanya boleh menahan beberapa pesanan yang belum dibayar,
  // supaya kursi tidak ditahan massal. Penjualan loket (paid=true) tidak dibatasi.
  if (!paid) {
    const digits = normalizePhone(contact.phone);
    const r = await one(
      `SELECT count(*)::int AS n FROM bookings
       WHERE status = 'pending' AND right(regexp_replace(phone, '\\D', '', 'g'), 9) = right($1::text, 9)`,
      [digits],
    );
    if (r && r.n >= MAX_PENDING_PER_PHONE) {
      throw new HttpError(
        429,
        `Nomor HP ini masih punya ${r.n} pemesanan yang belum dibayar. Selesaikan atau tunggu batas waktunya habis sebelum memesan lagi.`,
      );
    }
  }

  const schedule = await one(
    `SELECT s.id, s.price, s.status, s.departure_at, s.departure_at > now() AS upcoming,
            b.capacity, b.status AS bus_status, r.status AS route_status
     FROM schedules s
     JOIN buses b ON b.id = s.bus_id
     JOIN routes r ON r.id = s.route_id
     WHERE s.id = $1`,
    [scheduleId],
  );
  if (!schedule) throw new HttpError(404, 'Jadwal tidak ditemukan.');
  if (schedule.status !== 'scheduled' || !schedule.upcoming || schedule.bus_status !== 'active' || schedule.route_status !== 'active') {
    throw new HttpError(409, 'Jadwal ini tidak lagi tersedia untuk dipesan.');
  }

  const seen = new Set();
  const cleanSeats = seats.map((s) => {
    const seat = Number(s.seat);
    const name = String(s.name || '').trim();
    if (!Number.isInteger(seat) || seat < 1 || seat > schedule.capacity) {
      throw new HttpError(400, 'Nomor kursi tidak valid.');
    }
    if (seen.has(seat)) throw new HttpError(400, 'Kursi yang sama dipilih dua kali.');
    seen.add(seat);
    if (name.length < 2) throw new HttpError(400, `Nama penumpang kursi ${seat} wajib diisi.`);
    if (name.length > 100) throw new HttpError(400, `Nama penumpang kursi ${seat} terlalu panjang.`);
    return { seat, name };
  });

  const total = schedule.price * cleanSeats.length;
  const status = paid ? 'paid' : 'pending';

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    try {
      await query(
        `WITH b AS (
           INSERT INTO bookings (code, schedule_id, customer_name, phone, email, total_amount, status, source, expires_at)
           VALUES ($1::text, $2::int, $3::text, $4::text, $5::text, $6::int, $7::text, $8::text,
                   CASE WHEN $7::text = 'pending' THEN now() + $9::int * interval '1 minute' ELSE NULL END)
           RETURNING id
         ), p AS (
           INSERT INTO payments (booking_id, method, amount, status, paid_at)
           SELECT id, $10::text, $6::int,
                  CASE WHEN $7::text = 'paid' THEN 'paid' ELSE 'pending' END,
                  CASE WHEN $7::text = 'paid' THEN now() ELSE NULL END
           FROM b RETURNING id
         ), s AS (
           INSERT INTO booking_seats (booking_id, schedule_id, seat_number, passenger_name)
           SELECT b.id, $2::int, x.seat, x.name
           FROM b, jsonb_to_recordset($11::jsonb) AS x(seat int, name text)
           RETURNING id
         )
         SELECT (SELECT id FROM b) AS id, (SELECT count(*) FROM s)::int AS n`,
        [
          code,
          scheduleId,
          contact.name,
          contact.phone,
          contact.email,
          total,
          status,
          paid ? 'counter' : 'online',
          expiryMin,
          method,
          JSON.stringify(cleanSeats),
        ],
      );
      return { code, total };
    } catch (e) {
      if (e?.code === '23505') {
        const where = `${e.constraint || ''} ${e.message || ''}`;
        if (/booking_seats/.test(where)) {
          throw new HttpError(409, 'Maaf, salah satu kursi baru saja dipesan orang lain. Pilih kursi lain.');
        }
        continue; // bentrok kode booking, coba kode baru
      }
      throw e;
    }
  }
  throw new HttpError(500, 'Gagal membuat kode pemesanan. Coba lagi.');
}

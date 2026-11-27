import { query, one } from '@/lib/db';
import { expireStale } from '@/lib/booking';
import { HttpError, handle, json, readJson } from '@/lib/api';
import { clientIp, rateLimit } from '@/lib/ratelimit';

/** Pelanggan mengonfirmasi sudah membayar. Admin yang memverifikasi dan melunasi. */
export const POST = handle(async (req, { params }) => {
  await rateLimit(`pay:${clientIp(req)}`, {
    limit: 20,
    windowSec: 600,
    message: 'Terlalu banyak konfirmasi pembayaran.',
  });
  const { code } = await params;
  const body = await readJson(req);
  const method = String(body.method || '');
  if (!['transfer', 'qris', 'ewallet'].includes(method)) {
    throw new HttpError(400, 'Pilih metode pembayaran: transfer bank, QRIS, atau e-wallet.');
  }
  const reference = String(body.reference || '').trim();
  const payerName = String(body.payerName || '').trim();
  if (reference.length < 3) throw new HttpError(400, 'Isi nomor referensi / 4 digit terakhir rekening pengirim.');
  if (reference.length > 100 || payerName.length > 100) throw new HttpError(400, 'Isian terlalu panjang.');

  await expireStale();
  const booking = await one('SELECT id, status FROM bookings WHERE code = $1::text', [String(code).toUpperCase()]);
  if (!booking) throw new HttpError(404, 'Kode pemesanan tidak ditemukan.');
  if (booking.status !== 'pending') {
    throw new HttpError(409, 'Pemesanan ini sudah tidak menunggu pembayaran (lunas, dibatalkan, atau kedaluwarsa).');
  }

  const rows = await query(
    `UPDATE payments SET method = $2::text, reference = $3::text, payer_name = $4::text,
                         status = 'submitted', submitted_at = now(), admin_note = ''
     WHERE booking_id = $1::int AND status IN ('pending', 'rejected', 'submitted') RETURNING id`,
    [booking.id, method, reference, payerName],
  );
  if (!rows[0]) throw new HttpError(409, 'Pembayaran tidak bisa diperbarui.');
  return json({ ok: true });
});

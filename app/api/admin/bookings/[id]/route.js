import { query } from '@/lib/db';
import { validateContact } from '@/lib/booking';
import { HttpError, json, readJson, withAdmin } from '@/lib/api';

async function getId(ctx) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) throw new HttpError(400, 'ID tidak valid.');
  return n;
}

export const PUT = withAdmin(async (req, ctx) => {
  const id = await getId(ctx);
  const body = await readJson(req);

  if (body.action === 'mark_paid') {
    const rows = await query(
      `WITH b AS (
         UPDATE bookings SET status = 'paid', expires_at = NULL WHERE id = $1::int AND status = 'pending' RETURNING id
       )
       UPDATE payments SET status = 'paid', paid_at = now()
       WHERE booking_id IN (SELECT id FROM b) RETURNING booking_id`,
      [id],
    );
    if (!rows[0]) throw new HttpError(409, 'Hanya pemesanan berstatus "Menunggu pembayaran" yang bisa ditandai lunas.');
    return json({ ok: true });
  }

  if (body.action === 'cancel') {
    const rows = await query(
      `WITH b AS (
         UPDATE bookings SET status = 'cancelled', expires_at = NULL
         WHERE id = $1::int AND status IN ('pending', 'paid') RETURNING id
       ), d AS (
         DELETE FROM booking_seats WHERE booking_id IN (SELECT id FROM b) RETURNING 1
       )
       UPDATE payments SET status = CASE WHEN status = 'paid' THEN 'refunded' ELSE 'failed' END
       WHERE booking_id IN (SELECT id FROM b) RETURNING booking_id`,
      [id],
    );
    if (!rows[0]) throw new HttpError(409, 'Pemesanan ini sudah dibatalkan atau kedaluwarsa.');
    return json({ ok: true });
  }

  if (body.action === 'update') {
    const contact = validateContact({
      customerName: body.customer_name,
      phone: body.phone,
      email: body.email,
    });
    const passengers = Array.isArray(body.passengers) ? body.passengers : [];
    const clean = passengers.map((p) => {
      const name = String(p.name || '').trim();
      if (name.length < 2 || name.length > 100) throw new HttpError(400, 'Nama penumpang tidak valid.');
      return { seat: Number(p.seat), name };
    });
    const rows = await query(
      `WITH b AS (
         UPDATE bookings SET customer_name = $2::text, phone = $3::text, email = $4::text
         WHERE id = $1::int RETURNING id
       ), s AS (
         UPDATE booking_seats bs SET passenger_name = x.name
         FROM jsonb_to_recordset($5::jsonb) AS x(seat int, name text)
         WHERE bs.booking_id = $1::int AND bs.seat_number = x.seat
         RETURNING bs.id
       )
       SELECT id FROM b`,
      [id, contact.name, contact.phone, contact.email, JSON.stringify(clean)],
    );
    if (!rows[0]) throw new HttpError(404, 'Pemesanan tidak ditemukan.');
    return json({ ok: true });
  }

  throw new HttpError(400, 'Aksi tidak dikenal.');
});

export const DELETE = withAdmin(async (_req, ctx) => {
  const id = await getId(ctx);
  const rows = await query('DELETE FROM bookings WHERE id = $1::int RETURNING id', [id]);
  if (!rows[0]) throw new HttpError(404, 'Pemesanan tidak ditemukan.');
  return json({ ok: true });
});

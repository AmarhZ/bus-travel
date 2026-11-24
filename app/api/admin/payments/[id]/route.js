import { query } from '@/lib/db';
import { HttpError, json, readJson, withAdmin } from '@/lib/api';

export const PUT = withAdmin(async (req, ctx) => {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID tidak valid.');
  const { action, note } = await readJson(req);
  const adminNote = String(note || '').trim().slice(0, 300);

  if (action === 'verify') {
    const rows = await query(
      `WITH p AS (
         UPDATE payments SET status = 'paid', paid_at = now(), admin_note = $2::text
         WHERE id = $1::int AND status IN ('pending', 'submitted', 'rejected')
           AND booking_id IN (SELECT id FROM bookings WHERE status = 'pending')
         RETURNING booking_id
       )
       UPDATE bookings SET status = 'paid', expires_at = NULL
       WHERE id IN (SELECT booking_id FROM p) RETURNING id`,
      [id, adminNote],
    );
    if (!rows[0]) {
      throw new HttpError(409, 'Pembayaran tidak bisa diverifikasi: pemesanan sudah kedaluwarsa, dibatalkan, atau sudah lunas.');
    }
    return json({ ok: true });
  }

  if (action === 'reject') {
    const rows = await query(
      `UPDATE payments SET status = 'rejected', admin_note = $2::text
       WHERE id = $1::int AND status IN ('pending', 'submitted') RETURNING id`,
      [id, adminNote],
    );
    if (!rows[0]) throw new HttpError(409, 'Pembayaran ini tidak bisa ditolak.');
    return json({ ok: true });
  }

  throw new HttpError(400, 'Aksi tidak dikenal.');
});

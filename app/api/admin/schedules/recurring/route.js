import { one, query } from '@/lib/db';
import { HttpError, json, readJson, withAdmin } from '@/lib/api';
import { expandDates } from '@/lib/recurrence';
import { TZ } from '@/lib/format';

/**
 * Buat banyak jadwal sekaligus: jam yang sama, pada hari-hari terpilih dalam rentang tanggal.
 * Jadwal yang sudah ada (bus dan waktu yang sama, belum dibatalkan) dilewati, jadi aman diulang.
 */
export const POST = withAdmin(async (req) => {
  const b = await readJson(req);

  const routeId = Number(b.route_id);
  const busId = Number(b.bus_id);
  const price = Number(b.price);
  const time = String(b.time || '');
  if (!Number.isInteger(routeId) || routeId < 1) throw new HttpError(400, 'Rute wajib dipilih.');
  if (!Number.isInteger(busId) || busId < 1) throw new HttpError(400, 'Bus wajib dipilih.');
  if (!Number.isInteger(price) || price < 0 || price > 100000000) throw new HttpError(400, 'Harga tidak valid.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, 'Jam berangkat tidak valid.');

  const { dates, error } = expandDates(String(b.start || ''), String(b.end || ''), b.days);
  if (error) throw new HttpError(400, error);

  const refs = await one(
    `SELECT (SELECT status FROM routes WHERE id = $1::int) AS route_status,
            (SELECT status FROM buses WHERE id = $2::int) AS bus_status`,
    [routeId, busId],
  );
  if (!refs.route_status) throw new HttpError(400, 'Rute tidak ditemukan.');
  if (!refs.bus_status) throw new HttpError(400, 'Bus tidak ditemukan.');

  const locals = dates.map((d) => `${d}T${time}`);
  const rows = await query(
    `INSERT INTO schedules (route_id, bus_id, departure_at, price, status)
     SELECT $1::int, $2::int, (x::timestamp AT TIME ZONE $3::text), $4::int, 'scheduled'
     FROM jsonb_array_elements_text($5::jsonb) AS x
     WHERE NOT EXISTS (
       SELECT 1 FROM schedules s
       WHERE s.bus_id = $2::int AND s.status <> 'cancelled'
         AND s.departure_at = (x::timestamp AT TIME ZONE $3::text)
     )
     RETURNING id`,
    [routeId, busId, TZ, price, JSON.stringify(locals)],
  );

  return json(
    {
      created: rows.length,
      skipped: locals.length - rows.length,
      warning:
        refs.bus_status !== 'active' || refs.route_status !== 'active'
          ? 'Bus atau rute sedang tidak aktif, jadi jadwal ini belum bisa dipesan pelanggan sampai diaktifkan.'
          : '',
    },
    201,
  );
});

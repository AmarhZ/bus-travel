import { query } from '@/lib/db';
import { createBooking, expireStale } from '@/lib/booking';
import { json, readJson, withAdmin } from '@/lib/api';

const BOOKING_STATUSES = ['pending', 'paid', 'cancelled', 'expired'];

export const GET = withAdmin(async (req) => {
  await expireStale();
  const sp = new URL(req.url).searchParams;
  const where = [];
  const params = [];

  const status = sp.get('status');
  if (status && BOOKING_STATUSES.includes(status)) {
    params.push(status);
    where.push(`bk.status = $${params.length}::text`);
  }
  const schedule = Number(sp.get('schedule'));
  if (Number.isInteger(schedule) && schedule > 0) {
    params.push(schedule);
    where.push(`bk.schedule_id = $${params.length}::int`);
  }
  const q = (sp.get('q') || '').trim();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(bk.code ILIKE $${params.length} OR bk.customer_name ILIKE $${params.length} OR bk.phone ILIKE $${params.length})`);
  }

  const rows = await query(
    `SELECT bk.id, bk.code, bk.customer_name, bk.phone, bk.email, bk.total_amount, bk.status, bk.source,
            bk.created_at, bk.expires_at, bk.schedule_id,
            s.departure_at, r.origin, r.destination, bus.name AS bus_name,
            pay.id AS payment_id, pay.method, pay.status AS payment_status, pay.reference,
            (SELECT coalesce(json_agg(json_build_object('seat', bs.seat_number, 'name', bs.passenger_name)
                                      ORDER BY bs.seat_number), '[]'::json)
             FROM booking_seats bs WHERE bs.booking_id = bk.id) AS seats
     FROM bookings bk
     JOIN schedules s ON s.id = bk.schedule_id
     JOIN routes r ON r.id = s.route_id
     JOIN buses bus ON bus.id = s.bus_id
     LEFT JOIN payments pay ON pay.booking_id = bk.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY bk.created_at DESC
     LIMIT 300`,
    params,
  );
  return json(rows);
});

/** Penjualan tiket di loket: langsung lunas. */
export const POST = withAdmin(async (req) => {
  const body = await readJson(req);
  const result = await createBooking({
    scheduleId: Number(body.scheduleId),
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    seats: body.seats,
    method: body.method || 'cash',
    paid: true,
  });
  return json(result, 201);
});

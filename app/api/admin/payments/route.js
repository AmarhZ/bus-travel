import { query } from '@/lib/db';
import { expireStale } from '@/lib/booking';
import { json, withAdmin } from '@/lib/api';

const STATUSES = ['pending', 'submitted', 'paid', 'rejected', 'failed', 'refunded'];

export const GET = withAdmin(async (req) => {
  await expireStale();
  const status = new URL(req.url).searchParams.get('status');
  const params = [];
  let where = '';
  if (status && STATUSES.includes(status)) {
    params.push(status);
    where = 'WHERE pay.status = $1::text';
  }
  const rows = await query(
    `SELECT pay.id, pay.booking_id, pay.method, pay.amount, pay.status, pay.reference, pay.payer_name,
            pay.admin_note, pay.submitted_at, pay.paid_at, pay.created_at,
            bk.code, bk.customer_name, bk.phone, bk.status AS booking_status, bk.expires_at,
            s.departure_at, r.origin, r.destination
     FROM payments pay
     JOIN bookings bk ON bk.id = pay.booking_id
     JOIN schedules s ON s.id = bk.schedule_id
     JOIN routes r ON r.id = s.route_id
     ${where}
     ORDER BY CASE pay.status WHEN 'submitted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, pay.created_at DESC
     LIMIT 300`,
    params,
  );
  return json(rows);
});

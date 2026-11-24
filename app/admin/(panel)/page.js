import Link from 'next/link';
import { query, one } from '@/lib/db';
import { expireStale } from '@/lib/booking';
import { BOOKING_STATUS, TZ, fmtDateTime, rupiah } from '@/lib/format';

export const metadata = { title: 'Ringkasan' };

export default async function DashboardPage() {
  await expireStale();

  const [stats, daily, upcoming, recent] = await Promise.all([
    one(
      `SELECT
         coalesce((SELECT sum(amount) FROM payments WHERE status = 'paid'
                   AND (paid_at AT TIME ZONE $1::text)::date = (now() AT TIME ZONE $1::text)::date), 0)::float8 AS revenue_today,
         coalesce((SELECT sum(amount) FROM payments WHERE status = 'paid'
                   AND date_trunc('month', paid_at AT TIME ZONE $1::text) = date_trunc('month', now() AT TIME ZONE $1::text)), 0)::float8 AS revenue_month,
         (SELECT count(*)::int FROM booking_seats bs JOIN bookings bk ON bk.id = bs.booking_id
           WHERE bk.status = 'paid' AND date_trunc('month', bk.created_at AT TIME ZONE $1::text) = date_trunc('month', now() AT TIME ZONE $1::text)) AS tickets_month,
         (SELECT count(*)::int FROM payments WHERE status = 'submitted') AS to_verify,
         (SELECT count(*)::int FROM bookings WHERE status = 'pending') AS pending_bookings,
         (SELECT count(*)::int FROM buses WHERE status = 'active') AS active_buses,
         (SELECT count(*)::int FROM schedules WHERE status = 'scheduled' AND departure_at > now()) AS upcoming_trips`,
      [TZ],
    ),
    query(
      `SELECT to_char(x.day, 'DD/MM') AS label,
              coalesce((SELECT sum(amount) FROM payments p WHERE p.status = 'paid'
                        AND (p.paid_at AT TIME ZONE $1::text)::date = x.day), 0)::float8 AS total
       FROM (SELECT ((now() AT TIME ZONE $1::text)::date - g) AS day FROM generate_series(0, 6) AS g) x
       ORDER BY x.day`,
      [TZ],
    ),
    query(
      `SELECT s.id, s.departure_at, r.origin, r.destination, b.name AS bus_name, b.capacity,
              (SELECT count(*)::int FROM booking_seats bs WHERE bs.schedule_id = s.id) AS sold
       FROM schedules s JOIN routes r ON r.id = s.route_id JOIN buses b ON b.id = s.bus_id
       WHERE s.status = 'scheduled' AND s.departure_at > now()
       ORDER BY s.departure_at LIMIT 8`,
    ),
    query(
      `SELECT bk.id, bk.code, bk.customer_name, bk.total_amount, bk.status, bk.created_at, r.origin, r.destination
       FROM bookings bk JOIN schedules s ON s.id = bk.schedule_id JOIN routes r ON r.id = s.route_id
       ORDER BY bk.created_at DESC LIMIT 8`,
    ),
  ]);

  const maxDay = Math.max(1, ...daily.map((d) => d.total));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ringkasan</h1>
          <p className="muted" style={{ margin: 0 }}>
            Penjualan, pembayaran, dan keberangkatan terdekat.
          </p>
        </div>
        <Link href="/admin/bookings" className="btn">
          Jual tiket di loket
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="n">{rupiah(stats.revenue_today)}</div>
          <div className="l">Pendapatan hari ini</div>
        </div>
        <div className="stat">
          <div className="n">{rupiah(stats.revenue_month)}</div>
          <div className="l">Pendapatan bulan ini</div>
        </div>
        <div className="stat">
          <div className="n">{stats.tickets_month}</div>
          <div className="l">Tiket terjual bulan ini</div>
        </div>
        <Link href="/admin/payments?status=submitted" style={{ textDecoration: 'none', color: 'inherit' }} className={`stat ${stats.to_verify > 0 ? 'attention' : ''}`}>
          <div className="n">{stats.to_verify}</div>
          <div className="l">Pembayaran perlu diverifikasi</div>
        </Link>
        <div className="stat">
          <div className="n">{stats.pending_bookings}</div>
          <div className="l">Pemesanan menunggu bayar</div>
        </div>
        <div className="stat">
          <div className="n">{stats.upcoming_trips}</div>
          <div className="l">Jadwal akan berangkat ({stats.active_buses} bus aktif)</div>
        </div>
      </div>

      <div className="cols-2">
        <section className="card">
          <h3>Pendapatan 7 hari terakhir</h3>
          <div className="bars" role="img" aria-label="Grafik batang pendapatan 7 hari terakhir">
            {daily.map((d) => (
              <div className="bar" key={d.label} title={rupiah(d.total)}>
                <span className="v">{d.total > 0 ? `${Math.round(d.total / 1000)}rb` : ''}</span>
                <div className="fill" style={{ height: `${Math.max(2, (d.total / maxDay) * 100)}%` }} />
                <span className="d">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="row-between">
            <h3>Keberangkatan terdekat</h3>
            <Link href="/admin/schedules" className="small">
              Kelola jadwal
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="muted">Belum ada jadwal mendatang. Tambahkan di menu Jadwal.</p>
          ) : (
            <div className="stack">
              {upcoming.map((u) => (
                <div key={u.id}>
                  <div className="row-between" style={{ gap: 8 }}>
                    <span>
                      <strong>
                        {u.origin} ke {u.destination}
                      </strong>
                      <br />
                      <span className="small muted">
                        {fmtDateTime(u.departure_at)} - {u.bus_name}
                      </span>
                    </span>
                    <span className="small">
                      {u.sold}/{u.capacity}
                    </span>
                  </div>
                  <div className="progress" aria-hidden="true" style={{ marginTop: 6 }}>
                    <span style={{ width: `${Math.min(100, (u.sold / u.capacity) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row-between">
          <h3>Pemesanan terbaru</h3>
          <Link href="/admin/bookings" className="small">
            Lihat semua
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Pemesan</th>
                <th>Rute</th>
                <th>Total</th>
                <th>Status</th>
                <th>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Belum ada pemesanan.
                  </td>
                </tr>
              )}
              {recent.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.code}</td>
                  <td>{b.customer_name}</td>
                  <td>
                    {b.origin} - {b.destination}
                  </td>
                  <td>{rupiah(b.total_amount)}</td>
                  <td>
                    <span className={`badge ${b.status === 'paid' ? 'ok' : b.status === 'pending' ? 'warn' : 'bad'}`}>
                      {BOOKING_STATUS[b.status]}
                    </span>
                  </td>
                  <td>{fmtDateTime(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

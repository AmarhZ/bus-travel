import Link from 'next/link';
import { query } from '@/lib/db';
import { expireStale } from '@/lib/booking';
import { getSettings } from '@/lib/settings';
import { TZ, fmtDate, fmtDuration, fmtTime, rupiah, tzLabel } from '@/lib/format';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 8;

async function loadSchedules({ from, to, date, limit = PAGE_SIZE + 1 }) {
  const params = [];
  const where = [
    `s.status = 'scheduled'`,
    `r.status = 'active'`,
    `b.status = 'active'`,
    `s.departure_at > now()`,
  ];
  if (from) {
    params.push(from);
    where.push(`r.origin = $${params.length}::text`);
  }
  if (to) {
    params.push(to);
    where.push(`r.destination = $${params.length}::text`);
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    params.push(TZ);
    params.push(date);
    where.push(`(s.departure_at AT TIME ZONE $${params.length - 1}::text)::date = $${params.length}::date`);
  }
  return query(
    `SELECT s.id, s.departure_at, s.price, r.origin, r.destination, r.boarding_point, r.dropoff_point,
            r.duration_min, b.name AS bus_name, b.bus_class, b.facilities, b.capacity,
            (SELECT count(*)::int FROM booking_seats bs WHERE bs.schedule_id = s.id) AS sold
     FROM schedules s
     JOIN routes r ON r.id = s.route_id
     JOIN buses b ON b.id = s.bus_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.departure_at
     LIMIT ${Math.max(1, Math.min(100, Number(limit) || PAGE_SIZE + 1))}`,
    params,
  );
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const from = typeof sp.from === 'string' ? sp.from : '';
  const to = typeof sp.to === 'string' ? sp.to : '';
  const date = typeof sp.date === 'string' ? sp.date : '';
  const searching = Boolean(from || to || date);
  const shown = Math.max(PAGE_SIZE, Math.min(96, parseInt(sp.limit, 10) || PAGE_SIZE));

  let settings;
  let schedules = [];
  let hasMore = false;
  let board = [];
  let routes = [];
  let fleet = [];
  let dbError = false;

  try {
    await expireStale();
    [settings, schedules, board, routes, fleet] = await Promise.all([
      getSettings(),
      loadSchedules({ from, to, date, limit: shown + 1 }),
      loadSchedules({ limit: 5 }),
      query(
        `SELECT r.origin, r.destination, r.duration_min, min(s.price)::int AS from_price, count(s.id)::int AS trips
         FROM routes r
         JOIN schedules s ON s.route_id = r.id AND s.status = 'scheduled' AND s.departure_at > now()
         WHERE r.status = 'active'
         GROUP BY r.id ORDER BY trips DESC, r.origin LIMIT 8`,
      ),
      query(
        `SELECT bus_class, count(*)::int AS n, max(capacity)::int AS seats, max(facilities) AS facilities
         FROM buses WHERE status = 'active' GROUP BY bus_class ORDER BY bus_class`,
      ),
    ]);
  } catch (e) {
    console.error(e);
    dbError = true;
  }

  if (dbError) {
    return (
      <main className="page-pad">
        <div className="container">
          <div className="alert error">
            Situs belum bisa memuat data. Pastikan DATABASE_URL sudah diisi dan skrip <code>npm run db:setup</code> sudah dijalankan.
          </div>
        </div>
      </main>
    );
  }

  hasMore = schedules.length > shown;
  schedules = schedules.slice(0, shown);
  const moreParams = new URLSearchParams();
  if (from) moreParams.set('from', from);
  if (to) moreParams.set('to', to);
  if (date) moreParams.set('date', date);
  moreParams.set('limit', String(shown + PAGE_SIZE));

  const allRoutes = await query(`SELECT DISTINCT origin, destination FROM routes WHERE status = 'active' ORDER BY origin, destination`);
  const originOptions = [...new Set(allRoutes.map((r) => r.origin))];
  const destOptions = [...new Set(allRoutes.map((r) => r.destination))];

  return (
    <>
      <SiteHeader name={settings.company_name} />

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Pilih kursi, bayar, berangkat.</h1>
            <p className="lead">
              {settings.tagline} Lihat jadwal, pilih nomor kursi sendiri, dan dapatkan e-tiket tanpa perlu membuat akun.
            </p>

            <form className="search-card" action="/#jadwal" method="get">
              <div className="field">
                <label htmlFor="from">Dari</label>
                <select id="from" name="from" className="input" defaultValue={from}>
                  <option value="">Semua kota</option>
                  {originOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="to">Ke</label>
                <select id="to" name="to" className="input" defaultValue={to}>
                  <option value="">Semua kota</option>
                  {destOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="date">Tanggal berangkat</label>
                <input id="date" name="date" type="date" className="input" defaultValue={date} />
              </div>
              <button className="btn signal full" type="submit">
                Cari jadwal
              </button>
            </form>
          </div>

          <div className="board" aria-label="Papan keberangkatan terdekat">
            <div className="board-title">
              <span>Keberangkatan terdekat</span>
              <span>{tzLabel}</span>
            </div>
            {board.length === 0 && <div className="board-empty">Belum ada jadwal.</div>}
            {board.map((t) => {
              const left = t.capacity - t.sold;
              return (
                <Link key={t.id} href={`/book/${t.id}`} className="board-row">
                  <span>{fmtTime(t.departure_at)}</span>
                  <span className="dest">
                    {t.origin} - {t.destination}
                  </span>
                  <span className={`seats ${left <= 5 ? 'low' : ''}`}>{left > 0 ? `${left} kursi` : 'penuh'}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="jadwal">
        <div className="container">
          <div className="section-head">
            <h2>{searching ? 'Hasil pencarian jadwal' : 'Jadwal yang akan berangkat'}</h2>
            {searching && (
              <p className="muted">
                {[from && `Dari ${from}`, to && `ke ${to}`, date && `tanggal ${fmtDate(date + 'T12:00:00Z')}`]
                  .filter(Boolean)
                  .join(', ')}
                .{' '}
                <Link href="/#jadwal">Hapus filter</Link>
              </p>
            )}
          </div>

          {schedules.length === 0 ? (
            <div className="card empty">
              <strong>Tidak ada jadwal yang cocok.</strong>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Coba ubah tanggal atau kota, atau <Link href="/#jadwal">lihat semua jadwal</Link>.
              </p>
            </div>
          ) : (
            <div className="trip-list">
              {schedules.map((t) => {
                const left = t.capacity - t.sold;
                return (
                  <article key={t.id} className="trip">
                    <div>
                      <div className="time">{fmtTime(t.departure_at)}</div>
                      <div className="date">{fmtDate(t.departure_at)}</div>
                    </div>
                    <div>
                      <div className="route">
                        {t.origin} ke {t.destination}
                      </div>
                      <div className="meta">
                        <span>{t.bus_class}</span>
                        <span>{fmtDuration(t.duration_min)}</span>
                        {t.boarding_point && <span>Naik di {t.boarding_point}</span>}
                      </div>
                      {t.facilities && <div className="meta small">{t.facilities}</div>}
                    </div>
                    <div className="buy">
                      <div>
                        <div className="price">{rupiah(t.price)}</div>
                        <div className="small muted">
                          {left > 0 ? `Sisa ${left} dari ${t.capacity} kursi` : 'Kursi penuh'}
                        </div>
                      </div>
                      {left > 0 ? (
                        <Link href={`/book/${t.id}`} className="btn">
                          Pilih kursi
                        </Link>
                      ) : (
                        <span className="badge bad">Penuh</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {hasMore && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href={`/?${moreParams.toString()}#jadwal`} className="btn ghost" scroll={false}>
                Tampilkan {PAGE_SIZE} jadwal lagi
              </Link>
            </div>
          )}
        </div>
      </section>

      {routes.length > 0 && (
        <section className="section tight">
          <div className="container">
            <div className="section-head">
              <h2>Rute yang tersedia</h2>
            </div>
            <div className="route-grid">
              {routes.map((r) => (
                <Link
                  key={`${r.origin}-${r.destination}`}
                  className="route-tile"
                  href={`/?from=${encodeURIComponent(r.origin)}&to=${encodeURIComponent(r.destination)}#jadwal`}
                >
                  <div className="r">
                    {r.origin} - {r.destination}
                  </div>
                  <div className="muted small">
                    {fmtDuration(r.duration_min)} - {r.trips} keberangkatan
                  </div>
                  <div className="price" style={{ marginTop: 8 }}>
                    mulai {rupiah(r.from_price)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {fleet.length > 0 && (
        <section className="section tight">
          <div className="container">
            <div className="section-head">
              <h2>Kelas bus</h2>
            </div>
            <div className="fleet-grid">
              {fleet.map((f) => (
                <div key={f.bus_class} className="fleet-card">
                  <div className="cls">{f.bus_class}</div>
                  <div className="muted small">
                    {f.n} unit - sampai {f.seats} kursi
                  </div>
                  {f.facilities && <p style={{ margin: '8px 0 0' }}>{f.facilities}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="cara-pesan">
        <div className="container">
          <div className="section-head">
            <h2>Cara memesan</h2>
          </div>
          <ol className="steps">
            <li>
              <strong>Cari jadwal</strong>
              Pilih kota asal, tujuan, dan tanggal berangkat.
            </li>
            <li>
              <strong>Pilih kursi</strong>
              Lihat denah bus, pilih nomor kursi yang kosong, dan isi nama penumpang.
            </li>
            <li>
              <strong>Bayar</strong>
              Transfer, QRIS, e-wallet, atau bayar di loket. Kursi ditahan {Math.round(Number(settings.payment_expiry_minutes) / 60 * 10) / 10} jam.
            </li>
            <li>
              <strong>Tunjukkan e-tiket</strong>
              Setelah pembayaran diverifikasi, tunjukkan kode pemesanan kepada petugas saat naik.
            </li>
          </ol>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}

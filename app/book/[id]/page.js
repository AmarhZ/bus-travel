import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one } from '@/lib/db';
import { expireStale, getTakenSeats } from '@/lib/booking';
import { getSettings } from '@/lib/settings';
import { fmtDateLong, fmtDuration, fmtTime, rupiah, tzLabel } from '@/lib/format';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import BookingForm from '@/components/BookingForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pilih kursi' };

export default async function BookPage({ params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  await expireStale();
  const [settings, t] = await Promise.all([
    getSettings(),
    one(
      `SELECT s.id, s.departure_at, s.price, s.status, s.departure_at > now() AS upcoming,
              r.origin, r.destination, r.boarding_point, r.dropoff_point, r.duration_min, r.status AS route_status,
              b.name AS bus_name, b.bus_class, b.capacity, b.seat_layout, b.facilities, b.status AS bus_status
       FROM schedules s JOIN routes r ON r.id = s.route_id JOIN buses b ON b.id = s.bus_id
       WHERE s.id = $1::int`,
      [id],
    ),
  ]);
  if (!t) notFound();

  const available = t.status === 'scheduled' && t.upcoming && t.bus_status === 'active' && t.route_status === 'active';
  const taken = available ? await getTakenSeats(id) : [];
  const maxSeats = Math.max(1, parseInt(settings.max_seats_per_booking, 10) || 6);

  return (
    <>
      <SiteHeader name={settings.company_name} />
      <main className="page-pad">
        <div className="container">
          <p className="small">
            <Link href="/#jadwal">Kembali ke jadwal</Link>
          </p>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row-between">
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
                  {t.origin} ke {t.destination}
                </h1>
                <p className="muted" style={{ margin: 0 }}>
                  {fmtDateLong(t.departure_at)}, pukul {fmtTime(t.departure_at)} {tzLabel} - {fmtDuration(t.duration_min)} - {t.bus_class} ({t.bus_name})
                </p>
                {(t.boarding_point || t.dropoff_point) && (
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    {t.boarding_point && <>Naik di {t.boarding_point}. </>}
                    {t.dropoff_point && <>Turun di {t.dropoff_point}.</>}
                  </p>
                )}
              </div>
              <div className="price">{rupiah(t.price)} / kursi</div>
            </div>
          </div>

          {available ? (
            <BookingForm
              scheduleId={t.id}
              price={t.price}
              capacity={t.capacity}
              layout={t.seat_layout}
              initialTaken={taken}
              maxSeats={maxSeats}
            />
          ) : (
            <div className="alert warn">
              Jadwal ini tidak lagi tersedia untuk dipesan. <Link href="/#jadwal">Lihat jadwal lain</Link>.
            </div>
          )}
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

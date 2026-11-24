import Link from 'next/link';
import { notFound } from 'next/navigation';
import { one, query } from '@/lib/db';
import { expireStale } from '@/lib/booking';
import { getSettings } from '@/lib/settings';
import {
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  fmtDateLong,
  fmtDateTime,
  fmtDuration,
  fmtTime,
  rupiah,
  tzLabel,
} from '@/lib/format';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { AutoRefresh, Countdown, PaymentForm, PrintButton } from '@/components/BookingStatus';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pesanan Anda' };

export default async function BookingPage({ params }) {
  const { code: rawCode } = await params;
  const code = String(rawCode).toUpperCase();

  await expireStale();
  const [settings, b] = await Promise.all([
    getSettings(),
    one(
      `SELECT bk.id, bk.code, bk.customer_name, bk.phone, bk.total_amount, bk.status, bk.expires_at, bk.created_at,
              s.departure_at, r.origin, r.destination, r.boarding_point, r.dropoff_point, r.duration_min,
              bus.name AS bus_name, bus.bus_class, bus.plate,
              pay.method, pay.status AS payment_status, pay.reference, pay.admin_note, pay.paid_at
       FROM bookings bk
       JOIN schedules s ON s.id = bk.schedule_id
       JOIN routes r ON r.id = s.route_id
       JOIN buses bus ON bus.id = s.bus_id
       LEFT JOIN payments pay ON pay.booking_id = bk.id
       WHERE bk.code = $1::text`,
      [code],
    ),
  ]);
  if (!b) notFound();

  const seats = await query(
    'SELECT seat_number, passenger_name FROM booking_seats WHERE booking_id = $1::int ORDER BY seat_number',
    [b.id],
  );

  const isPending = b.status === 'pending';
  const waiting = isPending && b.payment_status === 'submitted';
  const cash = b.method === 'cash';
  const instructions = (settings.payment_instructions || '').split('\n').filter(Boolean);
  const wa = (settings.whatsapp || '').replace(/\D/g, '');

  return (
    <>
      <SiteHeader name={settings.company_name} />
      <main className="page-pad">
        <div className="container" style={{ maxWidth: 860 }}>
          {isPending && <AutoRefresh seconds={20} />}

          {b.status === 'paid' && (
            <div className="alert ok no-print" style={{ marginBottom: 16 }}>
              <strong>Pembayaran lunas.</strong> Tunjukkan kode pemesanan ini kepada petugas saat naik bus.
            </div>
          )}
          {b.status === 'expired' && (
            <div className="alert error no-print" style={{ marginBottom: 16 }}>
              <strong>Pemesanan kedaluwarsa.</strong> Batas waktu pembayaran terlewat dan kursi sudah dilepas.{' '}
              <Link href="/#jadwal">Pesan lagi</Link>.
            </div>
          )}
          {b.status === 'cancelled' && (
            <div className="alert error no-print" style={{ marginBottom: 16 }}>
              <strong>Pemesanan dibatalkan.</strong>{' '}
              {b.payment_status === 'refunded'
                ? 'Pembayaran Anda akan dikembalikan. Hubungi kami bila belum menerimanya.'
                : 'Kursi sudah dilepas.'}
            </div>
          )}
          {isPending && !waiting && (
            <div className="alert warn no-print" style={{ marginBottom: 16 }}>
              <strong>Menunggu pembayaran.</strong> Bayar dalam <Countdown expiresAt={b.expires_at} /> atau kursi akan dilepas.
            </div>
          )}
          {waiting && (
            <div className="alert info no-print" style={{ marginBottom: 16 }}>
              <strong>Pembayaran sedang diverifikasi.</strong> Halaman ini memperbarui diri otomatis. Anda juga bisa kembali nanti dengan kode {b.code}.
            </div>
          )}

          <article className="ticket">
            <div className="ticket-head">
              <div>
                <div className="small" style={{ color: '#9fb3c6' }}>
                  Kode pemesanan
                </div>
                <div className="ticket-code">{b.code}</div>
              </div>
              <span className={`badge ${b.status === 'paid' ? 'ok' : b.status === 'pending' ? 'warn' : 'bad'}`}>
                {BOOKING_STATUS[b.status]}
              </span>
            </div>
            <dl className="ticket-body">
              <div>
                <dt>Rute</dt>
                <dd>
                  {b.origin} ke {b.destination}
                </dd>
              </div>
              <div>
                <dt>Berangkat</dt>
                <dd>
                  {fmtDateLong(b.departure_at)}, {fmtTime(b.departure_at)} {tzLabel}
                </dd>
              </div>
              <div>
                <dt>Bus</dt>
                <dd>
                  {b.bus_name} ({b.bus_class}) - {b.plate}
                </dd>
              </div>
              <div>
                <dt>Titik naik</dt>
                <dd>{b.boarding_point || '-'}</dd>
              </div>
              <div>
                <dt>Titik turun</dt>
                <dd>{b.dropoff_point || '-'}</dd>
              </div>
              <div>
                <dt>Perkiraan perjalanan</dt>
                <dd>{fmtDuration(b.duration_min)}</dd>
              </div>
              <div>
                <dt>Pemesan</dt>
                <dd>{b.customer_name}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{rupiah(b.total_amount)}</dd>
              </div>
              <div>
                <dt>Pembayaran</dt>
                <dd>
                  {PAYMENT_METHOD[b.method] || '-'} - {PAYMENT_STATUS[b.payment_status] || '-'}
                  {b.paid_at && <> ({fmtDateTime(b.paid_at)})</>}
                </dd>
              </div>
            </dl>
            <div className="ticket-seats">
              {seats.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Kursi</th>
                      <th>Nama penumpang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seats.map((s) => (
                      <tr key={s.seat_number}>
                        <td className="mono">{s.seat_number}</td>
                        <td>{s.passenger_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  Kursi sudah dilepas.
                </p>
              )}
            </div>
          </article>

          {b.status === 'paid' && (
            <div className="row no-print" style={{ marginTop: 16 }}>
              <PrintButton />
            </div>
          )}

          {isPending && !waiting && (
            <section className="card no-print" style={{ marginTop: 16 }}>
              {cash ? (
                <>
                  <h2>Bayar di loket</h2>
                  <p>
                    Datang ke loket sebelum batas waktu, sebutkan kode <strong className="mono">{b.code}</strong>, lalu bayar{' '}
                    <strong>{rupiah(b.total_amount)}</strong>. {settings.address && <>Alamat loket: {settings.address}.</>}
                  </p>
                  <p className="small muted" style={{ marginBottom: 0 }}>
                    Ingin bayar lewat transfer atau e-wallet? Gunakan formulir konfirmasi di bawah setelah membayar.
                  </p>
                </>
              ) : (
                <h2>Cara membayar</h2>
              )}
              {!cash && (
                <>
                  <p>
                    Bayar tepat <strong>{rupiah(b.total_amount)}</strong> ke salah satu akun berikut:
                  </p>
                  {instructions.length > 0 ? (
                    <ul>
                      {instructions.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Hubungi kami untuk detail pembayaran.</p>
                  )}
                </>
              )}
              <h3 style={{ marginTop: 20 }}>Sudah membayar? Konfirmasi di sini</h3>
              <PaymentForm
                code={b.code}
                defaultMethod={b.method}
                previousReference={b.reference}
                adminNote={b.payment_status === 'rejected' ? b.admin_note : ''}
              />
            </section>
          )}

          <p className="small muted no-print" style={{ marginTop: 16 }}>
            Butuh bantuan?{' '}
            {wa ? (
              <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo, saya ingin bertanya tentang pemesanan ${b.code}`)}`} target="_blank" rel="noreferrer">
                Chat WhatsApp
              </a>
            ) : (
              settings.contact_phone
            )}
            . Simpan kode <strong className="mono">{b.code}</strong> atau buka <Link href="/cek">Cek pesanan</Link>.
          </p>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

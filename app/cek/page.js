import { redirect } from 'next/navigation';
import { one } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { normalizePhone } from '@/lib/format';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cek pesanan' };

export default async function CekPage({ searchParams }) {
  const sp = await searchParams;
  const code = typeof sp.code === 'string' ? sp.code.trim().toUpperCase() : '';
  const phone = typeof sp.phone === 'string' ? sp.phone.trim() : '';
  const settings = await getSettings();

  let error = '';
  if (code || phone) {
    if (!code || !phone) {
      error = 'Isi kode pemesanan dan nomor HP.';
    } else {
      const b = await one('SELECT code, phone FROM bookings WHERE code = $1::text', [code]);
      if (b && normalizePhone(b.phone) === normalizePhone(phone)) redirect(`/booking/${b.code}`);
      error = 'Kode pemesanan atau nomor HP tidak cocok. Periksa kembali.';
    }
  }

  return (
    <>
      <SiteHeader name={settings.company_name} />
      <main className="page-pad">
        <div className="container" style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: '2.2rem' }}>Cek pesanan</h1>
          <p className="muted">Masukkan kode pemesanan dan nomor HP yang Anda pakai saat memesan.</p>
          <form className="card stack" method="get">
            <div className="field">
              <label htmlFor="code">Kode pemesanan</label>
              <input id="code" name="code" className="input mono" placeholder="BT7K2M9X" defaultValue={code} required />
            </div>
            <div className="field">
              <label htmlFor="phone">Nomor HP</label>
              <input id="phone" name="phone" className="input" inputMode="tel" placeholder="08123456789" defaultValue={phone} required />
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <button className="btn" type="submit">
              Lihat pesanan
            </button>
          </form>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

import Link from 'next/link';

function BusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="14" rx="3" />
      <path d="M3 11h18M7 17v3M17 17v3" />
      <circle cx="7.5" cy="14" r="0.6" fill="currentColor" />
      <circle cx="16.5" cy="14" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader({ name }) {
  return (
    <header className="site-header no-print">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BusIcon />
          </span>
          {name}
        </Link>
        <nav className="nav" aria-label="Menu utama">
          <Link href="/#jadwal">Jadwal</Link>
          <Link href="/#cara-pesan">Cara pesan</Link>
          <Link href="/cek">Cek pesanan</Link>
          <Link href="/#kontak">Kontak</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ settings }) {
  const wa = (settings.whatsapp || '').replace(/\D/g, '');
  return (
    <footer className="site-footer" id="kontak">
      <div className="container footer-grid">
        <div>
          <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{settings.company_name}</strong>
          <p style={{ marginTop: 6 }}>{settings.tagline}</p>
        </div>
        <div>
          <strong style={{ color: '#fff' }}>Hubungi kami</strong>
          <p style={{ marginTop: 6 }}>
            {settings.contact_phone && (
              <>
                Telepon: {settings.contact_phone}
                <br />
              </>
            )}
            {wa && (
              <>
                WhatsApp:{' '}
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                  +{wa}
                </a>
                <br />
              </>
            )}
            {settings.contact_email && <>Email: {settings.contact_email}</>}
          </p>
        </div>
        <div>
          <strong style={{ color: '#fff' }}>Loket</strong>
          <p style={{ marginTop: 6 }}>{settings.address || 'Alamat loket belum diisi.'}</p>
          <p className="small">
            <Link href="/admin">Masuk admin</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Ringkasan', exact: true },
  { href: '/admin/bookings', label: 'Pemesanan' },
  { href: '/admin/payments', label: 'Pembayaran' },
  { href: '/admin/schedules', label: 'Jadwal' },
  { href: '/admin/routes', label: 'Rute' },
  { href: '/admin/buses', label: 'Bus' },
  { href: '/admin/settings', label: 'Pengaturan' },
];

export default function AdminNav({ username, companyName }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <nav className="admin-side no-print" aria-label="Menu admin">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          B
        </span>
        <span>{companyName}</span>
      </div>
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
      <div className="spacer" />
      <Link href="/" className="link" target="_blank">
        Lihat situs
      </Link>
      <button className="link" onClick={logout}>
        Keluar ({username})
      </button>
    </nav>
  );
}

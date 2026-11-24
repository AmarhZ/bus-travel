import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import AdminNav from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export const metadata = { title: { default: 'Admin', template: '%s | Admin' }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  let name = 'Admin';
  try {
    name = (await getSettings()).company_name;
  } catch {
    // tampilkan nama bawaan
  }
  return (
    <div className="admin-shell">
      <AdminNav username={session.username} companyName={name} />
      <main className="admin-main">{children}</main>
    </div>
  );
}

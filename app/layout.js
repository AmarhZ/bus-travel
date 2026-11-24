import './globals.css';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  let name = 'Nusantara Trans';
  let tagline = 'Pesan tiket bus antarkota online.';
  try {
    const s = await getSettings();
    name = s.company_name || name;
    tagline = s.tagline || tagline;
  } catch {
    // database belum siap: pakai nilai bawaan
  }
  return {
    title: { default: `${name} - Tiket bus antarkota`, template: `%s | ${name}` },
    description: tagline,
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

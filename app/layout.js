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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2a1810',
};

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=JetBrains+Mono:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}

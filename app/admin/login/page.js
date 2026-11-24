import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Masuk admin' };

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  if (session) redirect('/admin');
  const sp = await searchParams;
  const next = typeof sp.next === 'string' && sp.next.startsWith('/admin') ? sp.next : '/admin';
  return (
    <main className="login-wrap">
      <LoginForm next={next} />
    </main>
  );
}

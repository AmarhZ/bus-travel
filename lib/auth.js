import { cookies } from 'next/headers';
import { COOKIE, verifySession } from './jwt';

/** Sesi admin saat ini (dari cookie), atau null. */
export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

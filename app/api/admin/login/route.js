import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { one } from '@/lib/db';
import { COOKIE, signSession } from '@/lib/jwt';
import { fail, handle, readJson } from '@/lib/api';
import { clientIp, rateLimit, resetLimit } from '@/lib/ratelimit';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const POST = handle(async (req) => {
  const { username, password } = await readJson(req);
  const name = String(username || '').trim();

  // Batasi percobaan per alamat IP dan per username (mencegah tebak-tebakan password).
  const ipKey = `login:ip:${clientIp(req)}`;
  const userKey = `login:user:${name.toLowerCase().slice(0, 60)}`;
  const msg = 'Terlalu banyak percobaan masuk.';
  await rateLimit(ipKey, { limit: 8, windowSec: 900, message: msg });
  await rateLimit(userKey, { limit: 15, windowSec: 900, message: msg });

  const user = await one('SELECT id, username, password_hash FROM admins WHERE username = $1', [name]);
  // Bandingkan hash walau user tidak ada, agar waktu respons tidak membocorkan nama pengguna.
  const dummy = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4w1pKp1pYb1pYb1pYb1pYb1pYb1u';
  const ok = await bcrypt.compare(String(password || ''), user ? user.password_hash : dummy);
  if (!user || !ok) {
    await wait(700);
    return fail('Username atau password salah.', 401);
  }
  await resetLimit(ipKey, userKey);
  const token = await signSession({ sub: String(user.id), username: user.username });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
});

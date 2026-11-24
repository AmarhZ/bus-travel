import bcrypt from 'bcryptjs';
import { one, query } from '@/lib/db';
import { HttpError, json, readJson, withAdmin } from '@/lib/api';

export const PUT = withAdmin(async (req, _ctx, session) => {
  const { current, next } = await readJson(req);
  if (String(next || '').length < 8) throw new HttpError(400, 'Password baru minimal 8 karakter.');
  const user = await one('SELECT id, password_hash FROM admins WHERE id = $1::int', [session.sub]);
  if (!user) throw new HttpError(404, 'Akun admin tidak ditemukan.');
  const ok = await bcrypt.compare(String(current || ''), user.password_hash);
  if (!ok) throw new HttpError(400, 'Password saat ini salah.');
  const hash = await bcrypt.hash(String(next), 10);
  await query('UPDATE admins SET password_hash = $1 WHERE id = $2::int', [hash, user.id]);
  return json({ ok: true });
});

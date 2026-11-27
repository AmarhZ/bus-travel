import { query } from '@/lib/db';
import { HttpError, json, readJson, withAdmin } from '@/lib/api';
import { getSettings, SETTING_KEYS, SETTING_MAX_LENGTH } from '@/lib/settings';

export const GET = withAdmin(async () => json(await getSettings()));

export const PUT = withAdmin(async (req) => {
  const body = await readJson(req);
  const clean = {};
  for (const k of SETTING_KEYS) {
    if (body[k] !== undefined) clean[k] = String(body[k]).trim().slice(0, SETTING_MAX_LENGTH[k] || 2000);
  }
  const exp = parseInt(clean.payment_expiry_minutes ?? '120', 10);
  if (!Number.isInteger(exp) || exp < 10 || exp > 10080) {
    throw new HttpError(400, 'Batas waktu pembayaran harus antara 10 dan 10080 menit.');
  }
  const max = parseInt(clean.max_seats_per_booking ?? '6', 10);
  if (!Number.isInteger(max) || max < 1 || max > 20) {
    throw new HttpError(400, 'Maksimal kursi per pemesanan harus antara 1 dan 20.');
  }
  if (!clean.company_name && clean.company_name !== undefined) throw new HttpError(400, 'Nama perusahaan wajib diisi.');
  await query(
    `INSERT INTO settings (key, value)
     SELECT key, value FROM jsonb_each_text($1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(clean)],
  );
  return json(await getSettings());
});

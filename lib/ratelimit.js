import { query } from './db';
import { HttpError } from './api';

/**
 * Pembatasan laju berbasis database (jendela tetap). Tidak butuh layanan tambahan,
 * dan tetap bekerja di Vercel serverless karena hitungannya disimpan di Postgres.
 *
 * Bila tabel rate_limits belum ada (db:setup belum dijalankan ulang), pembatasan
 * dilewati dan situs tetap berjalan; kesalahan dicatat di log.
 */

/** Alamat IP pengunjung. Di Vercel header ini diisi oleh Vercel, bukan oleh pengunjung. */
export function clientIp(req) {
  const h = req.headers;
  const raw =
    h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
  return raw.trim().slice(0, 64) || 'unknown';
}

function waitText(seconds) {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 90) return `${s} detik`;
  return `${Math.ceil(s / 60)} menit`;
}

/**
 * Hitung satu percobaan untuk `key`. Melempar HttpError 429 (dengan Retry-After)
 * bila sudah melewati `limit` dalam `windowSec` detik.
 */
export async function rateLimit(key, { limit, windowSec, message }) {
  let row;
  try {
    const rows = await query(
      `INSERT INTO rate_limits (key, window_start, count)
       VALUES ($1::text, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < now() - $2::int * interval '1 second'
                      THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - $2::int * interval '1 second'
                             THEN now() ELSE rate_limits.window_start END
       RETURNING count,
                 EXTRACT(EPOCH FROM (window_start + $2::int * interval '1 second' - now()))::float8 AS retry_after`,
      [key, windowSec],
    );
    row = rows[0];
    // bersihkan baris lama sesekali agar tabel tidak membengkak
    if (Math.random() < 0.02) {
      await query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
    }
  } catch (e) {
    console.error('rate limit dilewati:', e.message);
    return;
  }
  if (row && row.count > limit) {
    const wait = Math.max(1, Math.ceil(row.retry_after));
    throw new HttpError(
      429,
      `${message || 'Terlalu banyak percobaan.'} Coba lagi dalam ${waitText(wait)}.`,
      { 'Retry-After': String(wait) },
    );
  }
}

/** Hapus hitungan (mis. setelah login berhasil). */
export async function resetLimit(...keys) {
  try {
    await query('DELETE FROM rate_limits WHERE key = ANY($1::text[])', [keys]);
  } catch {
    // abaikan
  }
}

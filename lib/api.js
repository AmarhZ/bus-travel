import { NextResponse } from 'next/server';
import { getSession } from './auth';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

export function handleError(e) {
  if (e instanceof HttpError) return fail(e.message, e.status);
  // 23001 = restrict_violation (ON DELETE RESTRICT), 23503 = foreign_key_violation (NO ACTION)
  if (e?.code === '23001' || e?.code === '23503')
    return fail('Data ini masih dipakai data lain (mis. jadwal atau pemesanan), jadi tidak bisa dihapus.', 409);
  if (e?.code === '23505') return fail('Nilai yang sama sudah ada. Gunakan nilai yang berbeda.', 409);
  if (e?.code === '23514') return fail('Ada nilai yang tidak valid. Periksa kembali isian.', 400);
  console.error(e);
  return fail('Terjadi kesalahan di server. Coba lagi sebentar lagi.', 500);
}

/** Bungkus handler publik: tangkap error jadi respons JSON. */
export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Bungkus handler admin: wajib sesi valid (lapisan kedua di luar middleware). */
export function withAdmin(fn) {
  return async (req, ctx) => {
    try {
      const session = await getSession();
      if (!session) return fail('Tidak diizinkan. Silakan login.', 401);
      return await fn(req, ctx, session);
    } catch (e) {
      return handleError(e);
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Format data tidak valid.');
  }
}

// Dipakai di browser (pratinjau jumlah jadwal) dan di server (pembuatan sebenarnya),
// supaya angka yang dilihat admin sama dengan yang dibuat.

export const MAX_SPAN_DAYS = 92; // rentang tanggal maksimal
export const MAX_SCHEDULES = 200; // jadwal maksimal per permintaan

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(s) {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  // tolak tanggal yang tidak ada, mis. 2026-02-31
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t;
}

/**
 * Daftar tanggal 'YYYY-MM-DD' dari `start` sampai `end` (inklusif) yang harinya ada di `days`
 * (0 = Minggu ... 6 = Sabtu). Mengembalikan { dates } atau { error }.
 */
export function expandDates(start, end, days) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (a === null) return { error: 'Tanggal mulai tidak valid.' };
  if (b === null) return { error: 'Tanggal akhir tidak valid.' };
  if (b < a) return { error: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.' };
  const span = Math.round((b - a) / 86400000) + 1;
  if (span > MAX_SPAN_DAYS) return { error: `Rentang tanggal maksimal ${MAX_SPAN_DAYS} hari.` };
  const want = new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => d >= 0 && d <= 6));
  if (want.size === 0) return { error: 'Pilih minimal satu hari.' };
  const dates = [];
  for (let t = a; t <= b; t += 86400000) {
    const d = new Date(t);
    if (want.has(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10));
  }
  if (dates.length === 0) return { error: 'Tidak ada tanggal yang cocok dengan hari yang dipilih.' };
  if (dates.length > MAX_SCHEDULES) return { error: `Terlalu banyak jadwal (maksimal ${MAX_SCHEDULES} sekaligus).` };
  return { dates };
}

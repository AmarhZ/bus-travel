export const TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Jakarta';

const TZ_LABELS = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
export const tzLabel = TZ_LABELS[TZ] || TZ;

export function rupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function fmtDate(d) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(d));
}

export function fmtDateLong(d) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(d));
}

export function fmtTime(d) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(d))
    .replace('.', ':');
}

export function fmtDateTime(d) {
  if (!d) return '-';
  return `${fmtDate(d)}, ${fmtTime(d)} ${tzLabel}`;
}

export function fmtDuration(min) {
  const m = Number(min) || 0;
  if (!m) return '-';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} menit`;
  return r ? `${h} jam ${r} menit` : `${h} jam`;
}

export const BOOKING_STATUS = {
  pending: 'Menunggu pembayaran',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

export const PAYMENT_STATUS = {
  pending: 'Belum dibayar',
  submitted: 'Menunggu verifikasi',
  paid: 'Lunas',
  rejected: 'Ditolak',
  failed: 'Gagal',
  refunded: 'Dikembalikan',
};

export const PAYMENT_METHOD = {
  transfer: 'Transfer bank',
  qris: 'QRIS',
  ewallet: 'E-wallet',
  cash: 'Bayar di loket',
};

export const SCHEDULE_STATUS = {
  scheduled: 'Terjadwal',
  cancelled: 'Dibatalkan',
  departed: 'Berangkat',
  completed: 'Selesai',
};

export function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}

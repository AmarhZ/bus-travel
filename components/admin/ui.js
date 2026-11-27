'use client';

import { useEffect } from 'react';
import { BOOKING_STATUS, PAYMENT_STATUS, SCHEDULE_STATUS } from '@/lib/format';

/** fetch JSON ke API admin. Melempar Error(pesan) bila gagal; 401 -> kembali ke halaman login. */
export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // respons kosong
  }
  if (res.status === 401) {
    window.location.href = '/admin/login';
    throw new Error('Sesi berakhir. Silakan login lagi.');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Permintaan gagal.');
  return data;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const TONES = {
  booking: { pending: 'warn', paid: 'ok', cancelled: 'bad', expired: 'bad' },
  payment: { pending: '', submitted: 'warn', paid: 'ok', rejected: 'bad', failed: 'bad', refunded: 'accent' },
  schedule: { scheduled: 'accent', cancelled: 'bad', departed: 'ok', completed: 'ok' },
  bus: { active: 'ok', maintenance: 'warn', retired: 'bad' },
  route: { active: 'ok', inactive: 'bad' },
};
const LABELS = {
  booking: BOOKING_STATUS,
  payment: PAYMENT_STATUS,
  schedule: SCHEDULE_STATUS,
  bus: { active: 'Aktif', maintenance: 'Perawatan', retired: 'Pensiun' },
  route: { active: 'Aktif', inactive: 'Nonaktif' },
};

export function StatusBadge({ kind, value }) {
  if (!value) return <span className="muted">-</span>;
  return <span className={`badge ${TONES[kind]?.[value] || ''}`}>{LABELS[kind]?.[value] || value}</span>;
}

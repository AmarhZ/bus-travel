'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, StatusBadge } from '@/components/admin/ui';
import { PAYMENT_METHOD, fmtDateTime, rupiah } from '@/lib/format';

function Payments() {
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get('status') || '');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api(`/api/admin/payments${status ? `?status=${status}` : ''}`));
      setError('');
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(p, action) {
    let note = '';
    if (action === 'reject') {
      note = window.prompt('Alasan penolakan (akan terlihat oleh pelanggan):', 'Pembayaran tidak ditemukan di mutasi rekening.');
      if (note === null) return;
    } else if (!window.confirm(`Verifikasi pembayaran ${rupiah(p.amount)} untuk ${p.code}? Pemesanan akan berstatus Lunas.`)) {
      return;
    }
    try {
      await api(`/api/admin/payments/${p.id}`, { method: 'PUT', body: { action, note } });
      setNotice(action === 'verify' ? `Pembayaran ${p.code} diverifikasi.` : `Pembayaran ${p.code} ditolak.`);
      setError('');
      await load();
    } catch (e) {
      setError(e.message);
      setNotice('');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pembayaran</h1>
          <p className="muted" style={{ margin: 0 }}>
            Cocokkan konfirmasi pelanggan dengan mutasi rekening atau e-wallet, lalu verifikasi.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status pembayaran">
          <option value="">Semua status</option>
          <option value="submitted">Menunggu verifikasi</option>
          <option value="pending">Belum dibayar</option>
          <option value="paid">Lunas</option>
          <option value="rejected">Ditolak</option>
          <option value="refunded">Dikembalikan</option>
          <option value="failed">Gagal</option>
        </select>
        <button className="btn ghost" onClick={load}>
          Muat ulang
        </button>
      </div>

      {notice && <div className="alert ok" style={{ marginBottom: 14 }}>{notice}</div>}
      {error && <div className="alert error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Pelanggan</th>
              <th>Jumlah</th>
              <th>Metode & referensi</th>
              <th>Status</th>
              <th>Waktu</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={7} className="empty">
                  Memuat...
                </td>
              </tr>
            )}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Tidak ada pembayaran untuk filter ini.
                </td>
              </tr>
            )}
            {rows &&
              rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>
                    {p.customer_name}
                    <br />
                    <span className="small muted">
                      {p.origin} - {p.destination}
                    </span>
                  </td>
                  <td>
                    <strong>{rupiah(p.amount)}</strong>
                  </td>
                  <td>
                    {PAYMENT_METHOD[p.method]}
                    {p.reference && (
                      <div className="small">
                        Ref: <span className="mono">{p.reference}</span>
                        {p.payer_name && <> - {p.payer_name}</>}
                      </div>
                    )}
                    {p.admin_note && <div className="small muted">Catatan: {p.admin_note}</div>}
                  </td>
                  <td>
                    <StatusBadge kind="payment" value={p.status} />
                  </td>
                  <td className="small">
                    {p.paid_at ? `Lunas ${fmtDateTime(p.paid_at)}` : p.submitted_at ? `Dikirim ${fmtDateTime(p.submitted_at)}` : `Dibuat ${fmtDateTime(p.created_at)}`}
                  </td>
                  <td>
                    <div className="actions">
                      {['pending', 'submitted', 'rejected'].includes(p.status) && p.booking_status === 'pending' && (
                        <button className="btn sm" onClick={() => act(p, 'verify')}>
                          Verifikasi
                        </button>
                      )}
                      {['pending', 'submitted'].includes(p.status) && (
                        <button className="btn danger-ghost sm" onClick={() => act(p, 'reject')}>
                          Tolak
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<p>Memuat...</p>}>
      <Payments />
    </Suspense>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api, Modal, StatusBadge } from './ui';
import { fmtDateTime } from '@/lib/format';

/** Daftar penumpang untuk satu jadwal (pemesanan aktif: menunggu bayar dan lunas). */
export default function ManifestModal({ schedule, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const all = await api(`/api/admin/bookings?schedule=${schedule.id}`);
        setRows(all.filter((b) => b.status === 'paid' || b.status === 'pending'));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [schedule.id]);

  const passengers = (rows || [])
    .flatMap((b) => b.seats.map((s) => ({ ...s, booking: b })))
    .sort((a, b) => a.seat - b.seat);

  return (
    <Modal title="Daftar penumpang" onClose={onClose} wide>
      <p className="muted">
        {schedule.origin} - {schedule.destination}, {fmtDateTime(schedule.departure_at)} - {schedule.bus_name} ({schedule.plate})
      </p>
      {error && <div className="alert error">{error}</div>}
      {rows === null && !error && <p>Memuat...</p>}
      {rows && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kursi</th>
                <th>Penumpang</th>
                <th>Pemesan / HP</th>
                <th>Kode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {passengers.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    Belum ada penumpang.
                  </td>
                </tr>
              )}
              {passengers.map((p) => (
                <tr key={p.seat}>
                  <td className="mono">{p.seat}</td>
                  <td>{p.name}</td>
                  <td>
                    {p.booking.customer_name}
                    <br />
                    <span className="small muted">{p.booking.phone}</span>
                  </td>
                  <td className="mono">{p.booking.code}</td>
                  <td>
                    <StatusBadge kind="booking" value={p.booking.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="modal-foot no-print">
        <button className="btn ghost" onClick={() => window.print()}>
          Cetak
        </button>
        <button className="btn" onClick={onClose}>
          Selesai
        </button>
      </div>
    </Modal>
  );
}

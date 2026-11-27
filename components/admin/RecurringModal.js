'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, Modal } from './ui';
import { expandDates } from '@/lib/recurrence';
import { rupiah } from '@/lib/format';

const DAYS = [
  { v: 1, label: 'Sen' },
  { v: 2, label: 'Sel' },
  { v: 3, label: 'Rab' },
  { v: 4, label: 'Kam' },
  { v: 5, label: 'Jum' },
  { v: 6, label: 'Sab' },
  { v: 0, label: 'Min' },
];

function isoToday(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function RecurringModal({ onClose, onDone }) {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [f, setF] = useState({
    route_id: '',
    bus_id: '',
    time: '07:00',
    price: '100000',
    start: isoToday(1),
    end: isoToday(30),
    days: [1, 2, 3, 4, 5, 6, 0],
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/admin/routes').then(setRoutes).catch((e) => setError(e.message));
    api('/api/admin/buses').then(setBuses).catch((e) => setError(e.message));
  }, []);

  const preview = useMemo(() => expandDates(f.start, f.end, f.days), [f.start, f.end, f.days]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleDay = (v) => set('days', f.days.includes(v) ? f.days.filter((d) => d !== v) : [...f.days, v]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (preview.error) return setError(preview.error);
    setBusy(true);
    try {
      const r = await api('/api/admin/schedules/recurring', {
        method: 'POST',
        body: { ...f, route_id: Number(f.route_id), bus_id: Number(f.bus_id), price: Number(f.price) },
      });
      setResult(r);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  if (result) {
    return (
      <Modal title="Jadwal berulang dibuat" onClose={onDone}>
        <div className="alert ok">
          <strong>{result.created} jadwal dibuat.</strong>
          {result.skipped > 0 && <> {result.skipped} dilewati karena bus yang sama sudah punya jadwal di waktu itu.</>}
        </div>
        {result.warning && (
          <div className="alert warn" style={{ marginTop: 12 }}>
            {result.warning}
          </div>
        )}
        <div className="modal-foot">
          <button className="btn" onClick={onDone}>
            Selesai
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Buat jadwal berulang" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="rr">Rute</label>
            <select id="rr" className="input" required value={f.route_id} onChange={(e) => set('route_id', e.target.value)}>
              <option value="">Pilih...</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origin} - {r.destination}
                  {r.status === 'inactive' ? ' (nonaktif)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rb">Bus</label>
            <select id="rb" className="input" required value={f.bus_id} onChange={(e) => set('bus_id', e.target.value)}>
              <option value="">Pilih...</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.plate} ({b.capacity} kursi){b.status !== 'active' ? ` [${b.status}]` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rt">Jam berangkat</label>
            <input id="rt" className="input" type="time" required value={f.time} onChange={(e) => set('time', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rp">Harga per kursi (Rp)</label>
            <input id="rp" className="input" type="number" min={0} required value={f.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rs">Dari tanggal</label>
            <input id="rs" className="input" type="date" required value={f.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="re">Sampai tanggal</label>
            <input id="re" className="input" type="date" required value={f.end} onChange={(e) => set('end', e.target.value)} />
            <span className="hint">Maksimal 92 hari sekali buat.</span>
          </div>
          <div className="field full">
            <span className="label" id="days-label">
              Berangkat pada hari
            </span>
            <div className="day-picker" role="group" aria-labelledby="days-label">
              {DAYS.map((d) => (
                <label key={d.v} className={`day-chip ${f.days.includes(d.v) ? 'on' : ''}`}>
                  <input type="checkbox" checked={f.days.includes(d.v)} onChange={() => toggleDay(d.v)} />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={`alert ${preview.error ? 'warn' : 'info'}`} style={{ marginTop: 16 }} aria-live="polite">
          {preview.error ? (
            preview.error
          ) : (
            <>
              Akan dibuat sampai <strong>{preview.dates.length} jadwal</strong> pukul {f.time}, mulai {preview.dates[0]} sampai{' '}
              {preview.dates[preview.dates.length - 1]}, harga {rupiah(Number(f.price) || 0)} per kursi. Jadwal yang sudah ada dilewati.
            </>
          )}
        </div>

        {error && (
          <div className="alert error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn" type="submit" disabled={busy || !!preview.error}>
            {busy ? 'Membuat...' : 'Buat jadwal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

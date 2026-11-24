'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, Modal, StatusBadge } from '@/components/admin/ui';
import SeatPicker from '@/components/SeatPicker';
import { PAYMENT_METHOD, fmtDateTime, rupiah } from '@/lib/format';

export default function BookingsPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [selling, setSelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      setRows(await api(`/api/admin/bookings?${params}`));
      setError('');
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pemesanan</h1>
          <p className="muted" style={{ margin: 0 }}>
            Semua pemesanan online dan penjualan loket. Klik baris untuk melihat detail atau mengubah.
          </p>
        </div>
        <button className="btn" onClick={() => setSelling(true)}>
          Jual tiket di loket
        </button>
      </div>

      <div className="toolbar">
        <input className="input" placeholder="Cari kode, nama, atau HP" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pemesanan" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
          <option value="">Semua status</option>
          <option value="pending">Menunggu pembayaran</option>
          <option value="paid">Lunas</option>
          <option value="cancelled">Dibatalkan</option>
          <option value="expired">Kedaluwarsa</option>
        </select>
        <button className="btn ghost" onClick={load}>
          Muat ulang
        </button>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Pemesan</th>
              <th>Perjalanan</th>
              <th>Kursi</th>
              <th>Total</th>
              <th>Status</th>
              <th>Bayar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={8} className="empty">
                  Memuat...
                </td>
              </tr>
            )}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  Tidak ada pemesanan yang cocok.
                </td>
              </tr>
            )}
            {rows &&
              rows.map((b) => (
                <tr key={b.id}>
                  <td className="mono">
                    {b.code}
                    {b.source === 'counter' && <div className="small muted">loket</div>}
                  </td>
                  <td>
                    {b.customer_name}
                    <br />
                    <span className="small muted">{b.phone}</span>
                  </td>
                  <td>
                    {b.origin} - {b.destination}
                    <br />
                    <span className="small muted">{fmtDateTime(b.departure_at)}</span>
                  </td>
                  <td>{b.seats.map((s) => s.seat).join(', ') || '-'}</td>
                  <td>{rupiah(b.total_amount)}</td>
                  <td>
                    <StatusBadge kind="booking" value={b.status} />
                  </td>
                  <td>
                    <StatusBadge kind="payment" value={b.payment_status} />
                    <div className="small muted">{PAYMENT_METHOD[b.method]}</div>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn ghost sm" onClick={() => setDetail(b)}>
                        Detail
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detail && <DetailModal booking={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); load(); }} />}
      {selling && <SellModal onClose={() => setSelling(false)} onDone={() => { setSelling(false); load(); }} />}
    </>
  );
}

function DetailModal({ booking: b, onClose, onChanged }) {
  const [form, setForm] = useState({ customer_name: b.customer_name, phone: b.phone, email: b.email || '' });
  const [passengers, setPassengers] = useState(Object.fromEntries(b.seats.map((s) => [s.seat, s.name])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError('');
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const save = () =>
    run(() =>
      api(`/api/admin/bookings/${b.id}`, {
        method: 'PUT',
        body: { action: 'update', ...form, passengers: Object.entries(passengers).map(([seat, name]) => ({ seat: Number(seat), name })) },
      }),
    );
  const markPaid = () => {
    if (window.confirm(`Tandai ${b.code} sebagai lunas?`)) run(() => api(`/api/admin/bookings/${b.id}`, { method: 'PUT', body: { action: 'mark_paid' } }));
  };
  const cancel = () => {
    const extra = b.status === 'paid' ? ' Pembayaran akan ditandai "Dikembalikan" dan perlu Anda refund.' : '';
    if (window.confirm(`Batalkan pemesanan ${b.code}? Kursi akan dilepas.${extra}`)) run(() => api(`/api/admin/bookings/${b.id}`, { method: 'PUT', body: { action: 'cancel' } }));
  };
  const remove = () => {
    if (window.confirm(`Hapus pemesanan ${b.code} secara permanen? Riwayat pembayarannya ikut terhapus.`)) run(() => api(`/api/admin/bookings/${b.id}`, { method: 'DELETE' }));
  };

  return (
    <Modal title={`Pemesanan ${b.code}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <StatusBadge kind="booking" value={b.status} />
        <StatusBadge kind="payment" value={b.payment_status} />
        <span className="muted small">
          {b.origin} - {b.destination}, {fmtDateTime(b.departure_at)}
        </span>
      </div>
      <p>
        Total <strong>{rupiah(b.total_amount)}</strong> - {PAYMENT_METHOD[b.method]}
        {b.reference && <> - referensi: <span className="mono">{b.reference}</span></>}
      </p>
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="dn">Nama pemesan</label>
          <input id="dn" className="input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="dp">Nomor HP</label>
          <input id="dp" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="de">Email</label>
          <input id="de" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        {b.seats.map((s) => (
          <div className="field" key={s.seat}>
            <label htmlFor={`ds${s.seat}`}>Penumpang kursi {s.seat}</label>
            <input id={`ds${s.seat}`} className="input" value={passengers[s.seat] ?? ''} onChange={(e) => setPassengers({ ...passengers, [s.seat]: e.target.value })} />
          </div>
        ))}
      </div>
      {error && <div className="alert error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          {b.status === 'pending' && (
            <button className="btn signal" disabled={busy} onClick={markPaid}>
              Tandai lunas
            </button>
          )}
          {(b.status === 'pending' || b.status === 'paid') && (
            <button className="btn danger-ghost" disabled={busy} onClick={cancel}>
              Batalkan
            </button>
          )}
          <button className="btn danger-ghost" disabled={busy} onClick={remove}>
            Hapus
          </button>
        </div>
        <div className="row">
          <a className="btn ghost" href={`/booking/${b.code}`} target="_blank" rel="noreferrer">
            Buka halaman tiket
          </a>
          <button className="btn" disabled={busy} onClick={save}>
            Simpan perubahan
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SellModal({ onClose, onDone }) {
  const [schedules, setSchedules] = useState(null);
  const [scheduleId, setScheduleId] = useState('');
  const [seatInfo, setSeatInfo] = useState(null);
  const [selected, setSelected] = useState([]);
  const [names, setNames] = useState({});
  const [contact, setContact] = useState({ customerName: '', phone: '', email: '' });
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const all = await api('/api/admin/schedules');
        const now = Date.now();
        setSchedules(all.filter((s) => s.status === 'scheduled' && new Date(s.departure_at).getTime() > now).reverse());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function pick(id) {
    setScheduleId(id);
    setSelected([]);
    setSeatInfo(null);
    if (!id) return;
    try {
      const res = await fetch(`/api/schedules/${id}/seats`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeatInfo(data);
    } catch (e) {
      setError(e.message);
    }
  }

  const schedule = schedules?.find((s) => String(s.id) === String(scheduleId));
  const toggle = (n) => setSelected((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!scheduleId) return setError('Pilih jadwal lebih dulu.');
    if (selected.length === 0) return setError('Pilih minimal satu kursi.');
    setBusy(true);
    try {
      const seats = selected.map((n, i) => ({ seat: n, name: (names[n] ?? (i === 0 ? contact.customerName : '')).trim() }));
      await api('/api/admin/bookings', { method: 'POST', body: { scheduleId: Number(scheduleId), ...contact, seats, method } });
      onDone();
    } catch (err) {
      setError(err.message);
      if (scheduleId) pick(scheduleId);
      setBusy(false);
    }
  }

  return (
    <Modal title="Jual tiket di loket" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="sj">Jadwal</label>
          <select id="sj" className="input" required value={scheduleId} onChange={(e) => pick(e.target.value)}>
            <option value="">{schedules === null ? 'Memuat...' : 'Pilih jadwal...'}</option>
            {(schedules || []).map((s) => (
              <option key={s.id} value={s.id}>
                {fmtDateTime(s.departure_at)} - {s.origin} ke {s.destination} ({s.capacity - s.sold} kursi sisa) - {rupiah(s.price)}
              </option>
            ))}
          </select>
        </div>

        {seatInfo && (
          <div style={{ margin: '16px 0' }}>
            <SeatPicker capacity={seatInfo.capacity} layout={seatInfo.layout} taken={seatInfo.taken} selected={selected} onToggle={toggle} max={20} />
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="sn">Nama pemesan</label>
            <input id="sn" className="input" required value={contact.customerName} onChange={(e) => setContact({ ...contact, customerName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sp">Nomor HP</label>
            <input id="sp" className="input" required inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
          </div>
          {selected.map((n, i) => (
            <div className="field" key={n}>
              <label htmlFor={`sp${n}`}>Penumpang kursi {n}</label>
              <input id={`sp${n}`} className="input" required value={names[n] ?? (i === 0 ? contact.customerName : '')} onChange={(e) => setNames({ ...names, [n]: e.target.value })} />
            </div>
          ))}
          <div className="field">
            <label htmlFor="sm">Metode pembayaran</label>
            <select id="sm" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer bank</option>
              <option value="qris">QRIS</option>
              <option value="ewallet">E-wallet</option>
            </select>
          </div>
        </div>

        <div className="sum-row total">
          <span>Total (langsung lunas)</span>
          <span>{rupiah((schedule?.price || 0) * selected.length)}</span>
        </div>

        {error && <div className="alert error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan penjualan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

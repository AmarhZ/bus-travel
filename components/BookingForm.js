'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SeatPicker from './SeatPicker';
import { rupiah } from '@/lib/format';

const METHODS = [
  { id: 'transfer', label: 'Transfer bank', hint: 'Kirim ke rekening kami, lalu konfirmasi.' },
  { id: 'qris', label: 'QRIS', hint: 'Scan QRIS, lalu konfirmasi.' },
  { id: 'ewallet', label: 'E-wallet', hint: 'DANA, OVO, atau GoPay.' },
  { id: 'cash', label: 'Bayar di loket', hint: 'Bayar tunai sebelum batas waktu.' },
];

export default function BookingForm({ scheduleId, price, capacity, layout, initialTaken, maxSeats }) {
  const router = useRouter();
  const [taken, setTaken] = useState(initialTaken);
  const [selected, setSelected] = useState([]);
  const [names, setNames] = useState({});
  const [contact, setContact] = useState({ customerName: '', phone: '', email: '' });
  const [method, setMethod] = useState('transfer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function toggle(n) {
    setSelected((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b)));
  }

  async function refreshSeats() {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/seats`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setTaken(data.taken);
        setSelected((cur) => cur.filter((n) => !data.taken.includes(n)));
      }
    } catch {
      // abaikan
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (selected.length === 0) return setError('Pilih minimal satu kursi di denah.');
    setBusy(true);
    try {
      const seats = selected.map((n, i) => ({
        seat: n,
        name: (names[n] ?? (i === 0 ? contact.customerName : '')).trim(),
      }));
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, ...contact, seats, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal membuat pemesanan.');
        if (res.status === 409) await refreshSeats();
        setBusy(false);
        return;
      }
      router.push(`/booking/${data.code}`);
    } catch {
      setError('Koneksi bermasalah. Periksa internet Anda lalu coba lagi.');
      setBusy(false);
    }
  }

  const total = price * selected.length;

  return (
    <form className="layout-2" onSubmit={submit}>
      <div>
        <section className="card">
          <h2>1. Pilih kursi</h2>
          <p className="muted small">Maksimal {maxSeats} kursi per pemesanan.</p>
          <SeatPicker capacity={capacity} layout={layout} taken={taken} selected={selected} onToggle={toggle} max={maxSeats} />
        </section>

        <section className="card">
          <h2>2. Data pemesan</h2>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="cn">Nama pemesan</label>
              <input
                id="cn"
                className="input"
                required
                autoComplete="name"
                value={contact.customerName}
                onChange={(e) => setContact({ ...contact, customerName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ph">Nomor HP / WhatsApp</label>
              <input
                id="ph"
                className="input"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="08123456789"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="em">Email (opsional)</label>
              <input
                id="em"
                className="input"
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
            </div>
          </div>
        </section>

        {selected.length > 0 && (
          <section className="card">
            <h2>3. Nama penumpang</h2>
            <div className="form-grid">
              {selected.map((n, i) => (
                <div className="field" key={n}>
                  <label htmlFor={`p${n}`}>Kursi {n}</label>
                  <input
                    id={`p${n}`}
                    className="input"
                    required
                    placeholder="Sesuai identitas"
                    value={names[n] ?? (i === 0 ? contact.customerName : '')}
                    onChange={(e) => setNames({ ...names, [n]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2>{selected.length > 0 ? '4' : '3'}. Metode pembayaran</h2>
          <div className="pay-options" role="radiogroup" aria-label="Metode pembayaran">
            {METHODS.map((m) => (
              <label key={m.id} className="pay-option">
                <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
                <span>
                  <strong>{m.label}</strong>
                  <br />
                  <span className="small muted">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="card sticky">
        <h3>Ringkasan</h3>
        <div className="sum-row hide-sm">
          <span className="muted">Kursi</span>
          <span>{selected.length ? selected.join(', ') : '-'}</span>
        </div>
        <div className="sum-row hide-sm">
          <span className="muted">Harga per kursi</span>
          <span>{rupiah(price)}</span>
        </div>
        <div className="sum-row total">
          <span>
            Total
            <small className="show-sm"> ({selected.length} kursi)</small>
          </span>
          <span>{rupiah(total)}</span>
        </div>
        {error && (
          <div className="alert error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        <button className="btn signal block" type="submit" disabled={busy} style={{ marginTop: 14 }}>
          {busy ? 'Memproses...' : 'Pesan sekarang'}
        </button>
        <p className="small muted hide-sm" style={{ marginTop: 10, marginBottom: 0 }}>
          Setelah memesan, Anda mendapat kode pemesanan untuk membayar dan melihat e-tiket.
        </p>
      </aside>
    </form>
  );
}

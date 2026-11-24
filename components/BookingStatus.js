'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Hitung mundur batas pembayaran. Saat habis, muat ulang halaman supaya status ikut berubah. */
export function Countdown({ expiresAt }) {
  const router = useRouter();
  const target = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(null);

  useEffect(() => {
    const tick = () => {
      const ms = target - Date.now();
      setLeft(ms);
      if (ms <= 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  if (left === null) return <span>...</span>;
  if (left <= 0) return <span>waktu habis</span>;
  const s = Math.floor(left / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <span className="mono">
      {pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}

/** Muat ulang data server secara berkala selama menunggu verifikasi admin. */
export function AutoRefresh({ seconds = 20 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function PrintButton() {
  return (
    <button type="button" className="btn ghost no-print" onClick={() => window.print()}>
      Cetak tiket
    </button>
  );
}

export function PaymentForm({ code, defaultMethod, previousReference, adminNote }) {
  const router = useRouter();
  const [method, setMethod] = useState(['transfer', 'qris', 'ewallet'].includes(defaultMethod) ? defaultMethod : 'transfer');
  const [reference, setReference] = useState(previousReference || '');
  const [payerName, setPayerName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${code}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, reference, payerName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengirim konfirmasi.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="stack">
      {adminNote && (
        <div className="alert error">
          Pembayaran sebelumnya ditolak. Catatan admin: {adminNote}
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pm">Metode yang Anda pakai</label>
          <select id="pm" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="transfer">Transfer bank</option>
            <option value="qris">QRIS</option>
            <option value="ewallet">E-wallet</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pn">Nama pengirim</label>
          <input id="pn" className="input" value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Sesuai nama di rekening/e-wallet" />
        </div>
        <div className="field full">
          <label htmlFor="pr">Nomor referensi atau 4 digit terakhir rekening pengirim</label>
          <input id="pr" className="input" required value={reference} onChange={(e) => setReference(e.target.value)} />
          <span className="hint">Admin memakai ini untuk mencocokkan pembayaran Anda.</span>
        </div>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Mengirim...' : 'Saya sudah membayar'}
      </button>
    </form>
  );
}

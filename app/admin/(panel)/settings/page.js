'use client';

import { useEffect, useState } from 'react';
import { api } from '@/components/admin/ui';

const FIELDS = [
  { name: 'company_name', label: 'Nama perusahaan', required: true },
  { name: 'tagline', label: 'Slogan', full: true },
  { name: 'contact_phone', label: 'Telepon' },
  { name: 'whatsapp', label: 'WhatsApp (format 628xxx)', hint: 'Dipakai untuk tautan chat di halaman tiket.' },
  { name: 'contact_email', label: 'Email' },
  { name: 'address', label: 'Alamat loket', full: true },
  { name: 'payment_expiry_minutes', label: 'Batas waktu pembayaran (menit)', type: 'number', hint: 'Kursi dilepas bila belum dibayar.' },
  { name: 'max_seats_per_booking', label: 'Maksimal kursi per pemesanan', type: 'number' },
  {
    name: 'payment_instructions',
    label: 'Instruksi pembayaran',
    type: 'textarea',
    full: true,
    hint: 'Satu akun per baris. Ditampilkan kepada pelanggan setelah memesan.',
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');

  useEffect(() => {
    api('/api/admin/settings').then(setValues).catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
    try {
      setValues(await api('/api/admin/settings', { method: 'PUT', body: values }));
      setOk('Pengaturan disimpan.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwOk('');
    if (pw.next !== pw.confirm) return setPwError('Konfirmasi password tidak sama.');
    try {
      await api('/api/admin/password', { method: 'PUT', body: { current: pw.current, next: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      setPwOk('Password diganti.');
    } catch (err) {
      setPwError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pengaturan</h1>
          <p className="muted" style={{ margin: 0 }}>
            Profil perusahaan, aturan pemesanan, dan akun admin.
          </p>
        </div>
      </div>

      <form className="card" onSubmit={save}>
        <h3>Situs dan pembayaran</h3>
        {values === null && !error && <p>Memuat...</p>}
        {values && (
          <div className="form-grid">
            {FIELDS.map((f) => (
              <div key={f.name} className={`field ${f.full ? 'full' : ''}`}>
                <label htmlFor={f.name}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={f.name} className="input" rows={5} value={values[f.name] ?? ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                ) : (
                  <input id={f.name} className="input" type={f.type || 'text'} required={f.required} value={values[f.name] ?? ''} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                )}
                {f.hint && <span className="hint">{f.hint}</span>}
              </div>
            ))}
          </div>
        )}
        {error && <div className="alert error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
        {ok && <div className="alert ok" style={{ marginTop: 14 }}>{ok}</div>}
        <div className="modal-foot">
          <button className="btn" type="submit" disabled={busy || !values}>
            {busy ? 'Menyimpan...' : 'Simpan pengaturan'}
          </button>
        </div>
      </form>

      <form className="card" onSubmit={changePassword}>
        <h3>Ganti password admin</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="pc">Password saat ini</label>
            <input id="pc" className="input" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="pn">Password baru</label>
            <input id="pn" className="input" type="password" autoComplete="new-password" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <span className="hint">Minimal 8 karakter.</span>
          </div>
          <div className="field">
            <label htmlFor="pf">Ulangi password baru</label>
            <input id="pf" className="input" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
        </div>
        {pwError && <div className="alert error" role="alert" style={{ marginTop: 14 }}>{pwError}</div>}
        {pwOk && <div className="alert ok" style={{ marginTop: 14 }}>{pwOk}</div>}
        <div className="modal-foot">
          <button className="btn" type="submit">
            Ganti password
          </button>
        </div>
      </form>
    </>
  );
}

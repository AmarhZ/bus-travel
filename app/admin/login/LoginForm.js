'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ next }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal masuk.');
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError('Koneksi bermasalah. Coba lagi.');
      setBusy(false);
    }
  }

  return (
    <form className="login-card stack" onSubmit={submit}>
      <div>
        <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>Masuk admin</h1>
        <p className="muted small" style={{ margin: 0 }}>
          Halaman ini khusus pengelola. Pelanggan tidak perlu masuk untuk memesan tiket.
        </p>
      </div>
      <div className="field">
        <label htmlFor="u">Username</label>
        <input id="u" className="input" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="p">Password</label>
        <input id="p" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Memeriksa...' : 'Masuk'}
      </button>
    </form>
  );
}

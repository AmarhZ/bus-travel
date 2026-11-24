'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, Modal } from './ui';

/**
 * Halaman CRUD generik untuk admin.
 * columns:  [{ key, label, render?(row) }]
 * fields:   [{ name, label, type: text|number|select|datetime-local|textarea, options?, lookup?, optionLabel?, required?, full?, default?, hint? }]
 */
export default function CrudPage({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  lookups = {},
  createLabel = 'Tambah',
  noun = 'data',
  rowActions,
  confirmSubmit,
  emptyText = 'Belum ada data.',
}) {
  const [rows, setRows] = useState(null);
  const [lookupData, setLookupData] = useState({});
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { row|null, values }
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api(endpoint));
      setError('');
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
    Object.entries(lookups).forEach(async ([key, url]) => {
      try {
        const data = await api(url);
        setLookupData((p) => ({ ...p, [key]: data }));
      } catch {
        // dropdown tetap kosong; error tampil saat simpan
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function optionsFor(f) {
    if (f.options) return f.options;
    if (f.lookup) {
      return (lookupData[f.lookup] || []).map((r) => ({ value: String(r.id), label: f.optionLabel ? f.optionLabel(r) : String(r.id) }));
    }
    return [];
  }

  function openCreate() {
    const values = {};
    for (const f of fields) values[f.name] = f.default !== undefined ? String(f.default) : '';
    setFormError('');
    setModal({ row: null, values });
  }

  function openEdit(row) {
    const values = {};
    for (const f of fields) values[f.name] = row[f.name] === null || row[f.name] === undefined ? '' : String(row[f.name]);
    setFormError('');
    setModal({ row, values });
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    if (confirmSubmit) {
      const msg = confirmSubmit(modal.values, modal.row);
      if (msg && !window.confirm(msg)) return;
    }
    setBusy(true);
    try {
      if (modal.row) await api(`${endpoint}/${modal.row.id}`, { method: 'PUT', body: modal.values });
      else await api(endpoint, { method: 'POST', body: modal.values });
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    }
    setBusy(false);
  }

  async function remove(row) {
    if (!window.confirm(`Hapus ${noun} ini? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api(`${endpoint}/${row.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted" style={{ margin: 0 }}>{subtitle}</p>}
        </div>
        <button className="btn" onClick={openCreate}>
          {createLabel}
        </button>
      </div>

      {error && (
        <div className="alert error" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  Memuat...
                </td>
              </tr>
            )}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="empty">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows &&
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
                  ))}
                  <td>
                    <div className="actions">
                      {rowActions && rowActions(row, { reload: load })}
                      <button className="btn ghost sm" onClick={() => openEdit(row)}>
                        Ubah
                      </button>
                      <button className="btn danger-ghost sm" onClick={() => remove(row)}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal.row ? `Ubah ${noun}` : `${createLabel} ${noun}`} onClose={() => setModal(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              {fields.map((f) => {
                const id = `f-${f.name}`;
                const value = modal.values[f.name];
                const set = (v) => setModal({ ...modal, values: { ...modal.values, [f.name]: v } });
                return (
                  <div key={f.name} className={`field ${f.full ? 'full' : ''}`}>
                    <label htmlFor={id}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select id={id} className="input" required={f.required} value={value} onChange={(e) => set(e.target.value)}>
                        {!f.noEmpty && <option value="">Pilih...</option>}
                        {optionsFor(f).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea id={id} className="input" required={f.required} value={value} onChange={(e) => set(e.target.value)} />
                    ) : (
                      <input
                        id={id}
                        className="input"
                        type={f.type || 'text'}
                        required={f.required}
                        min={f.min}
                        max={f.max}
                        placeholder={f.placeholder}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    )}
                    {f.hint && <span className="hint">{f.hint}</span>}
                  </div>
                );
              })}
            </div>
            {formError && (
              <div className="alert error" role="alert" style={{ marginTop: 14 }}>
                {formError}
              </div>
            )}
            <div className="modal-foot">
              <button type="button" className="btn ghost" onClick={() => setModal(null)}>
                Batal
              </button>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

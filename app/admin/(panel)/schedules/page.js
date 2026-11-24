'use client';

import { useState } from 'react';
import CrudPage from '@/components/admin/CrudPage';
import ManifestModal from '@/components/admin/ManifestModal';
import { StatusBadge } from '@/components/admin/ui';
import { fmtDateTime, rupiah } from '@/lib/format';

const lookups = { routes: '/api/admin/routes', buses: '/api/admin/buses' };

const columns = [
  { key: 'departure_at', label: 'Berangkat', render: (r) => <strong>{fmtDateTime(r.departure_at)}</strong> },
  { key: 'route', label: 'Rute', render: (r) => `${r.origin} - ${r.destination}` },
  { key: 'bus_name', label: 'Bus', render: (r) => <>{r.bus_name}<br /><span className="small muted mono">{r.plate}</span></> },
  { key: 'price', label: 'Harga', render: (r) => rupiah(r.price) },
  {
    key: 'sold',
    label: 'Terisi',
    render: (r) => (
      <div>
        {r.sold}/{r.capacity}
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (r.sold / r.capacity) * 100)}%` }} />
        </div>
      </div>
    ),
  },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge kind="schedule" value={r.status} /> },
];

const fields = [
  {
    name: 'route_id',
    label: 'Rute',
    type: 'select',
    lookup: 'routes',
    required: true,
    optionLabel: (r) => `${r.origin} - ${r.destination}${r.status === 'inactive' ? ' (nonaktif)' : ''}`,
  },
  {
    name: 'bus_id',
    label: 'Bus',
    type: 'select',
    lookup: 'buses',
    required: true,
    optionLabel: (b) => `${b.name} - ${b.plate} (${b.capacity} kursi)${b.status !== 'active' ? ` [${b.status}]` : ''}`,
  },
  { name: 'departure_local', label: 'Waktu berangkat', type: 'datetime-local', required: true, hint: 'Sesuai zona waktu situs.' },
  { name: 'price', label: 'Harga per kursi (Rp)', type: 'number', required: true, min: 0, default: 100000 },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    noEmpty: true,
    required: true,
    default: 'scheduled',
    options: [
      { value: 'scheduled', label: 'Terjadwal' },
      { value: 'departed', label: 'Berangkat' },
      { value: 'completed', label: 'Selesai' },
      { value: 'cancelled', label: 'Dibatalkan' },
    ],
  },
];

function confirmSubmit(values, row) {
  if (values.status === 'cancelled' && row?.status !== 'cancelled') {
    return 'Membatalkan jadwal akan membatalkan SEMUA pemesanan di jadwal ini. Pembayaran yang sudah lunas ditandai "Dikembalikan" dan perlu Anda refund. Lanjutkan?';
  }
  return null;
}

export default function SchedulesPage() {
  const [manifest, setManifest] = useState(null);
  return (
    <>
      <CrudPage
        title="Jadwal"
        subtitle="Keberangkatan, bus yang dipakai, dan harga tiket."
        endpoint="/api/admin/schedules"
        columns={columns}
        fields={fields}
        lookups={lookups}
        noun="jadwal"
        confirmSubmit={confirmSubmit}
        emptyText="Belum ada jadwal. Pastikan sudah ada rute dan bus, lalu tambahkan jadwal."
        rowActions={(row) => (
          <button className="btn ghost sm" onClick={() => setManifest(row)}>
            Penumpang
          </button>
        )}
      />
      {manifest && <ManifestModal schedule={manifest} onClose={() => setManifest(null)} />}
    </>
  );
}

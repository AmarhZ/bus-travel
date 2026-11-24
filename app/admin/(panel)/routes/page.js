'use client';

import CrudPage from '@/components/admin/CrudPage';
import { StatusBadge } from '@/components/admin/ui';
import { fmtDuration } from '@/lib/format';

const columns = [
  { key: 'route', label: 'Rute', render: (r) => <strong>{r.origin} - {r.destination}</strong> },
  {
    key: 'points',
    label: 'Titik naik / turun',
    render: (r) => <span className="small muted">{r.boarding_point || '-'} / {r.dropoff_point || '-'}</span>,
  },
  { key: 'distance_km', label: 'Jarak', render: (r) => (r.distance_km ? `${r.distance_km} km` : '-') },
  { key: 'duration_min', label: 'Durasi', render: (r) => fmtDuration(r.duration_min) },
  { key: 'schedule_count', label: 'Jadwal' },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge kind="route" value={r.status} /> },
];

const fields = [
  { name: 'origin', label: 'Kota asal', required: true, placeholder: 'Jakarta' },
  { name: 'destination', label: 'Kota tujuan', required: true, placeholder: 'Bandung' },
  { name: 'boarding_point', label: 'Titik naik', placeholder: 'Terminal Pulo Gebang' },
  { name: 'dropoff_point', label: 'Titik turun', placeholder: 'Terminal Leuwipanjang' },
  { name: 'distance_km', label: 'Jarak (km)', type: 'number', min: 0, default: 0 },
  { name: 'duration_min', label: 'Durasi perjalanan (menit)', type: 'number', required: true, min: 1, default: 180 },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    noEmpty: true,
    required: true,
    default: 'active',
    options: [
      { value: 'active', label: 'Aktif' },
      { value: 'inactive', label: 'Nonaktif' },
    ],
  },
];

export default function RoutesPage() {
  return (
    <CrudPage
      title="Rute"
      subtitle="Kota asal dan tujuan yang dilayani. Rute nonaktif tidak tampil di situs."
      endpoint="/api/admin/routes"
      columns={columns}
      fields={fields}
      noun="rute"
      emptyText="Belum ada rute. Tambahkan rute pertama Anda."
    />
  );
}

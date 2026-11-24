'use client';

import CrudPage from '@/components/admin/CrudPage';
import { StatusBadge } from '@/components/admin/ui';

const columns = [
  { key: 'name', label: 'Bus', render: (r) => <strong>{r.name}</strong> },
  { key: 'plate', label: 'Plat', render: (r) => <span className="mono">{r.plate}</span> },
  { key: 'bus_class', label: 'Kelas' },
  { key: 'capacity', label: 'Kursi', render: (r) => `${r.capacity} (${r.seat_layout})` },
  { key: 'facilities', label: 'Fasilitas', render: (r) => <span className="small muted">{r.facilities || '-'}</span> },
  { key: 'schedule_count', label: 'Jadwal' },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge kind="bus" value={r.status} /> },
];

const fields = [
  { name: 'name', label: 'Nama bus', required: true, placeholder: 'Nusantara Prima 01' },
  { name: 'plate', label: 'Plat nomor', required: true, placeholder: 'B 7001 NT' },
  { name: 'bus_class', label: 'Kelas', required: true, placeholder: 'Eksekutif', default: 'Eksekutif', hint: 'Contoh: Ekonomi, Bisnis, Eksekutif, Sleeper' },
  { name: 'capacity', label: 'Jumlah kursi', type: 'number', required: true, min: 1, max: 80, default: 32 },
  {
    name: 'seat_layout',
    label: 'Susunan kursi',
    type: 'select',
    noEmpty: true,
    required: true,
    default: '2-2',
    options: [
      { value: '2-2', label: '2-2 (dua kiri, dua kanan)' },
      { value: '2-1', label: '2-1 (dua kiri, satu kanan)' },
      { value: '1-1', label: '1-1 (satu kiri, satu kanan)' },
    ],
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    noEmpty: true,
    required: true,
    default: 'active',
    options: [
      { value: 'active', label: 'Aktif' },
      { value: 'maintenance', label: 'Perawatan' },
      { value: 'retired', label: 'Pensiun' },
    ],
  },
  { name: 'facilities', label: 'Fasilitas', type: 'textarea', full: true, placeholder: 'AC, Toilet, USB charger' },
];

export default function BusesPage() {
  return (
    <CrudPage
      title="Bus"
      subtitle="Armada, kapasitas, dan status. Bus berstatus Perawatan atau Pensiun tidak bisa dipesan."
      endpoint="/api/admin/buses"
      columns={columns}
      fields={fields}
      noun="bus"
      createLabel="Tambah"
      emptyText="Belum ada bus. Tambahkan bus pertama Anda."
    />
  );
}

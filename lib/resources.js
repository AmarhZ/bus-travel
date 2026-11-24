import { query, one } from './db';
import { HttpError } from './api';
import { TZ } from './format';

/**
 * Konfigurasi CRUD generik untuk bus, rute, dan jadwal.
 * Hanya kolom yang tercantum di `fields` yang bisa ditulis (daftar putih).
 */
export const resources = {
  buses: {
    table: 'buses',
    list: `SELECT b.*, (SELECT count(*)::int FROM schedules s WHERE s.bus_id = b.id) AS schedule_count
           FROM buses b ORDER BY b.id DESC`,
    fields: {
      name: { type: 'text', required: true, max: 100, label: 'Nama bus' },
      plate: { type: 'text', required: true, max: 20, upper: true, label: 'Plat nomor' },
      bus_class: { type: 'text', required: true, max: 30, label: 'Kelas' },
      capacity: { type: 'int', required: true, min: 1, max: 80, label: 'Kapasitas' },
      seat_layout: { type: 'enum', values: ['2-2', '2-1', '1-1'], label: 'Susunan kursi' },
      facilities: { type: 'text', max: 300, label: 'Fasilitas' },
      status: { type: 'enum', values: ['active', 'maintenance', 'retired'], label: 'Status' },
    },
    async beforeUpdate(id, data) {
      if (data.capacity !== undefined) {
        const r = await one(
          `SELECT coalesce(max(bs.seat_number), 0)::int AS max_seat
           FROM booking_seats bs JOIN schedules s ON s.id = bs.schedule_id
           WHERE s.bus_id = $1 AND s.status = 'scheduled'`,
          [id],
        );
        if (r && data.capacity < r.max_seat) {
          throw new HttpError(409, `Kapasitas tidak bisa di bawah ${r.max_seat}: sudah ada kursi nomor ${r.max_seat} yang dipesan di jadwal aktif.`);
        }
      }
    },
  },

  routes: {
    table: 'routes',
    list: `SELECT r.*, (SELECT count(*)::int FROM schedules s WHERE s.route_id = r.id) AS schedule_count
           FROM routes r ORDER BY r.origin, r.destination`,
    fields: {
      origin: { type: 'text', required: true, max: 80, label: 'Kota asal' },
      destination: { type: 'text', required: true, max: 80, label: 'Kota tujuan' },
      boarding_point: { type: 'text', max: 150, label: 'Titik naik' },
      dropoff_point: { type: 'text', max: 150, label: 'Titik turun' },
      distance_km: { type: 'int', min: 0, max: 20000, label: 'Jarak (km)' },
      duration_min: { type: 'int', required: true, min: 1, max: 6000, label: 'Durasi (menit)' },
      status: { type: 'enum', values: ['active', 'inactive'], label: 'Status' },
    },
  },

  schedules: {
    table: 'schedules',
    list: `SELECT s.id, s.route_id, s.bus_id, s.departure_at,
                  to_char(s.departure_at AT TIME ZONE $1, 'YYYY-MM-DD"T"HH24:MI') AS departure_local,
                  s.price, s.status, r.origin, r.destination, b.name AS bus_name, b.plate, b.capacity,
                  (SELECT count(*)::int FROM booking_seats bs WHERE bs.schedule_id = s.id) AS sold
           FROM schedules s
           JOIN routes r ON r.id = s.route_id
           JOIN buses b ON b.id = s.bus_id
           ORDER BY s.departure_at DESC LIMIT 500`,
    listParams: [TZ],
    fields: {
      route_id: { type: 'int', required: true, label: 'Rute' },
      bus_id: { type: 'int', required: true, label: 'Bus' },
      departure_local: { type: 'datetime', column: 'departure_at', required: true, label: 'Waktu berangkat' },
      price: { type: 'int', required: true, min: 0, max: 100000000, label: 'Harga per kursi' },
      status: { type: 'enum', values: ['scheduled', 'cancelled', 'departed', 'completed'], label: 'Status' },
    },
    async beforeUpdate(id, data) {
      if (data.bus_id !== undefined) {
        const r = await one(
          `SELECT (SELECT capacity FROM buses WHERE id = $2) AS cap,
                  (SELECT coalesce(max(seat_number), 0)::int FROM booking_seats WHERE schedule_id = $1) AS max_seat`,
          [id, data.bus_id],
        );
        if (!r || r.cap === null) throw new HttpError(400, 'Bus tidak ditemukan.');
        if (r.max_seat > r.cap) {
          throw new HttpError(409, `Bus baru hanya punya ${r.cap} kursi, padahal kursi nomor ${r.max_seat} sudah dipesan.`);
        }
      }
    },
    /** Jadwal dibatalkan: semua pemesanan aktifnya ikut dibatalkan, pembayaran lunas ditandai "Dikembalikan". */
    async afterUpdate(id, data) {
      if (data.status === 'cancelled') {
        await query(
          `WITH c AS (
             UPDATE bookings SET status = 'cancelled', expires_at = NULL
             WHERE schedule_id = $1 AND status IN ('pending', 'paid') RETURNING id
           ), d AS (
             DELETE FROM booking_seats WHERE booking_id IN (SELECT id FROM c) RETURNING 1
           ), p AS (
             UPDATE payments SET status = CASE WHEN status = 'paid' THEN 'refunded' ELSE 'failed' END
             WHERE booking_id IN (SELECT id FROM c) RETURNING 1
           )
           SELECT count(*)::int AS n FROM c`,
          [id],
        );
      }
    },
  },
};

/** Validasi + konversi nilai sesuai definisi field. Mengembalikan { column, value, type }. */
function coerce(name, def, raw, { partial }) {
  if (raw === undefined || raw === null || raw === '') {
    if (def.required && !partial) throw new HttpError(400, `${def.label} wajib diisi.`);
    if (def.required && partial && raw !== undefined) throw new HttpError(400, `${def.label} wajib diisi.`);
    if (raw === undefined) return null;
    if (def.type === 'int') return { column: def.column || name, value: 0, type: def.type };
    return { column: def.column || name, value: '', type: def.type };
  }
  const column = def.column || name;
  switch (def.type) {
    case 'text': {
      let v = String(raw).trim();
      if (def.upper) v = v.toUpperCase();
      if (def.max && v.length > def.max) throw new HttpError(400, `${def.label} maksimal ${def.max} karakter.`);
      if (def.required && !v) throw new HttpError(400, `${def.label} wajib diisi.`);
      return { column, value: v, type: 'text' };
    }
    case 'int': {
      const v = Number(raw);
      if (!Number.isInteger(v)) throw new HttpError(400, `${def.label} harus berupa bilangan bulat.`);
      if (def.min !== undefined && v < def.min) throw new HttpError(400, `${def.label} minimal ${def.min}.`);
      if (def.max !== undefined && v > def.max) throw new HttpError(400, `${def.label} maksimal ${def.max}.`);
      return { column, value: v, type: 'int' };
    }
    case 'enum': {
      if (!def.values.includes(raw)) throw new HttpError(400, `${def.label} tidak valid.`);
      return { column, value: raw, type: 'enum' };
    }
    case 'datetime': {
      const v = String(raw);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) throw new HttpError(400, `${def.label} tidak valid.`);
      return { column, value: v, type: 'datetime' };
    }
    default:
      throw new HttpError(500, 'Tipe field tidak dikenal');
  }
}

function build(cfg, body, { partial }) {
  const cols = [];
  const placeholders = [];
  const params = [];
  const parsed = {};
  for (const [name, def] of Object.entries(cfg.fields)) {
    const c = coerce(name, def, body?.[name], { partial });
    if (!c) continue;
    parsed[c.column] = c.value;
    params.push(c.value);
    const i = params.length;
    if (c.type === 'datetime') {
      params.push(TZ);
      placeholders.push(`($${i}::timestamp AT TIME ZONE $${i + 1}::text)`);
    } else if (c.type === 'int') {
      placeholders.push(`$${i}::int`);
    } else {
      placeholders.push(`$${i}::text`);
    }
    cols.push(c.column);
  }
  return { cols, placeholders, params, parsed };
}

export async function listResource(cfg) {
  return query(cfg.list, cfg.listParams || []);
}

export async function createResource(cfg, body) {
  const { cols, placeholders, params } = build(cfg, body, { partial: false });
  const rows = await query(
    `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
    params,
  );
  return rows[0];
}

export async function updateResource(cfg, id, body) {
  const { cols, placeholders, params, parsed } = build(cfg, body, { partial: true });
  if (cols.length === 0) throw new HttpError(400, 'Tidak ada perubahan.');
  if (cfg.beforeUpdate) await cfg.beforeUpdate(id, parsed);
  const sets = cols.map((c, i) => `${c} = ${placeholders[i]}`).join(', ');
  params.push(id);
  const rows = await query(`UPDATE ${cfg.table} SET ${sets} WHERE id = $${params.length}::int RETURNING id`, params);
  if (!rows[0]) throw new HttpError(404, 'Data tidak ditemukan.');
  if (cfg.afterUpdate) await cfg.afterUpdate(id, parsed);
  return rows[0];
}

export async function deleteResource(cfg, id) {
  const rows = await query(`DELETE FROM ${cfg.table} WHERE id = $1::int RETURNING id`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Data tidak ditemukan.');
  return rows[0];
}

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS buses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  bus_class TEXT NOT NULL DEFAULT 'Eksekutif',
  capacity INT NOT NULL CHECK (capacity BETWEEN 1 AND 80),
  seat_layout TEXT NOT NULL DEFAULT '2-2' CHECK (seat_layout IN ('2-2', '2-1', '1-1')),
  facilities TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  boarding_point TEXT NOT NULL DEFAULT '',
  dropoff_point TEXT NOT NULL DEFAULT '',
  distance_km INT NOT NULL DEFAULT 0,
  duration_min INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  route_id INT NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  bus_id INT NOT NULL REFERENCES buses(id) ON DELETE RESTRICT,
  departure_at TIMESTAMPTZ NOT NULL,
  price INT NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'departed', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_departure ON schedules (departure_at);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  total_amount INT NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'counter')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings (schedule_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

CREATE TABLE IF NOT EXISTS booking_seats (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  schedule_id INT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  seat_number INT NOT NULL CHECK (seat_number >= 1),
  passenger_name TEXT NOT NULL,
  UNIQUE (schedule_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_booking_seats_booking ON booking_seats (booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'qris', 'ewallet', 'cash')),
  amount INT NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'rejected', 'failed', 'refunded')),
  reference TEXT NOT NULL DEFAULT '',
  payer_name TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 0
);

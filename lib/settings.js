import { query } from './db';

export const DEFAULT_SETTINGS = {
  company_name: 'Nusantara Trans',
  tagline: 'Naik bus antarkota, pesan kursi dari rumah.',
  contact_phone: '',
  whatsapp: '',
  contact_email: '',
  address: '',
  payment_expiry_minutes: '120',
  max_seats_per_booking: '6',
  payment_instructions: '',
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export async function getSettings() {
  const rows = await query('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

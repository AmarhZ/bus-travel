import { neon } from '@neondatabase/serverless';

let client;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL belum diatur');
    client = neon(url);
  }
  return client;
}

/** Jalankan query berparameter ($1, $2, ...) dan kembalikan array baris. */
export async function query(text, params = []) {
  return getClient().query(text, params);
}

/** Kembalikan baris pertama atau null. */
export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

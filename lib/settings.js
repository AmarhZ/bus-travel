import { query } from './db';

// Format faq & policy: setiap blok dipisah satu baris kosong.
// Baris pertama blok = judul/pertanyaan, baris sisanya = isi/jawaban.
const DEFAULT_FAQ = `Apakah saya perlu membuat akun untuk memesan tiket?
Tidak perlu. Pilih jadwal, pilih kursi, isi nama dan nomor HP, lalu bayar. Anda mendapat kode pemesanan untuk melihat e-tiket kapan saja di menu Cek pesanan.

Bagaimana cara membayar?
Setelah memesan, bayar sesuai instruksi di halaman tiket (transfer bank, QRIS, atau e-wallet), lalu tekan "Saya sudah membayar" dan isi nomor referensi. Admin akan memverifikasi, dan status pesanan berubah menjadi Lunas.

Berapa lama kursi saya ditahan?
Kursi ditahan selama batas waktu yang tertera di halaman tiket. Jika belum dibayar sampai batas itu, pesanan kedaluwarsa dan kursi dilepas otomatis.

Apa yang harus ditunjukkan saat naik bus?
Tunjukkan kode pemesanan (di layar HP atau hasil cetak) beserta identitas sesuai nama penumpang. Tiba di titik naik minimal 30 menit sebelum berangkat.

Bagaimana jika saya salah mengisi nama atau ingin mengubah pesanan?
Hubungi kami lewat WhatsApp atau telepon dengan menyebutkan kode pemesanan. Perubahan dilakukan oleh admin.`;

const DEFAULT_POLICY = `Pembatalan dan pengembalian dana
Hubungi kami sebelum jadwal berangkat dengan menyebutkan kode pemesanan. Ketentuan pengembalian dana mengikuti kebijakan perusahaan dan diproses manual oleh admin.

Bagasi
Setiap penumpang boleh membawa satu koper atau tas besar di bagasi dan satu tas kecil di kabin. Barang berharga dan dokumen sebaiknya dibawa sendiri.

Anak-anak
Anak-anak yang menempati kursi sendiri dihitung sebagai penumpang dan membeli tiket. Cantumkan nama anak pada kolom nama penumpang.

Keterlambatan dan perubahan jadwal
Jadwal dapat berubah karena cuaca, lalu lintas, atau kondisi bus. Jika jadwal dibatalkan, pemesanan dibatalkan dan pembayaran yang sudah lunas dikembalikan.`;

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
  faq: DEFAULT_FAQ,
  policy: DEFAULT_POLICY,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

/** Batas panjang per kolom saat disimpan dari admin. */
export const SETTING_MAX_LENGTH = { faq: 8000, policy: 8000 };

export async function getSettings() {
  const rows = await query('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

/** Ubah teks berformat blok menjadi [{ title, body }]. Blok tanpa isi dilewati. */
export function parseBlocks(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return { title: lines[0] || '', body: lines.slice(1).join('\n') };
    })
    .filter((b) => b.title && b.body);
}

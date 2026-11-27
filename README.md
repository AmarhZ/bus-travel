# Nusantara Trans: situs tiket bus

Situs travel bus dengan:

- **Landing page publik** (tanpa login): cari jadwal, pilih kursi di denah, pesan, bayar, cek pesanan, cetak e-tiket.
- **Panel admin** (`/admin`, wajib login): ringkasan penjualan, kelola bus, rute, jadwal, pemesanan, pembayaran, jual tiket di loket, dan pengaturan situs.
- **Next.js 15 (JavaScript)**, database **Neon Postgres**, deploy ke **Vercel**.

## 1. Siapkan database Neon

1. Buat proyek di https://console.neon.tech.
2. Salin *connection string* (pilih yang **pooled**, berakhiran `sslmode=require`).

## 2. Jalankan di komputer sendiri

```bash
npm install
cp .env.example .env.local     # lalu isi DATABASE_URL, AUTH_SECRET, ADMIN_PASSWORD
npm run db:seed                # buat tabel + akun admin + data contoh
npm run dev                    # buka http://localhost:3000
```

- `npm run db:setup` membuat tabel dan akun admin saja (tanpa data contoh). Pakai ini untuk produksi.
- Skrip aman dijalankan berulang kali: akun admin yang sudah ada tidak ditimpa.
- Buat `AUTH_SECRET` dengan `openssl rand -base64 32`.
- Masuk admin di `/admin` memakai `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari `.env.local`. Ganti password di menu Pengaturan.

## 3. Deploy ke Vercel

1. Unggah proyek ke repositori GitHub, lalu impor di https://vercel.com/new.
2. Di **Settings > Environment Variables** isi:
   - `DATABASE_URL`: connection string Neon
   - `AUTH_SECRET`: string acak panjang
   - `NEXT_PUBLIC_TIMEZONE`: `Asia/Jakarta`, `Asia/Makassar`, atau `Asia/Jayapura`
3. Deploy. Tabel dan akun admin dibuat dari komputer Anda (langkah 2) dengan `DATABASE_URL` yang sama, jadi Vercel tidak perlu menjalankan migrasi.
4. Buka `https://domain-anda.vercel.app/admin` dan masuk.

Alternatif tanpa Git: `npm i -g vercel && vercel --prod`.

## Cara kerja pemesanan dan pembayaran

1. Pelanggan memilih jadwal dan kursi, mengisi nama, lalu memesan. Kursi ditahan selama **batas waktu pembayaran** (bawaan 120 menit, atur di Pengaturan).
2. Pelanggan membayar (transfer, QRIS, e-wallet) sesuai instruksi di halaman tiket, lalu menekan **Saya sudah membayar** dan mengisi referensi.
3. Admin membuka menu **Pembayaran**, mencocokkan dengan mutasi rekening, lalu menekan **Verifikasi**. Pemesanan menjadi **Lunas**. Admin juga bisa **Tolak** dengan alasan.
4. Pemesanan yang tidak dibayar sampai batas waktu menjadi **Kedaluwarsa** dan kursinya dilepas otomatis. Yang sudah mengirim konfirmasi tidak dikedaluwarsakan sampai admin memutuskan.
5. Penjualan di loket dicatat dari menu Pemesanan (**Jual tiket di loket**) dan langsung lunas.

Pembatalan jadwal membatalkan semua pemesanan aktifnya. Pembayaran yang sudah lunas ditandai **Dikembalikan**; pengembalian dana dilakukan manual oleh admin.

## Catatan penting

- **Pembayaran diverifikasi manual.** Belum ada integrasi payment gateway (Midtrans, Xendit, dsb.). Bila ingin otomatis, tambahkan webhook yang memanggil logika yang sama dengan `app/api/admin/payments/[id]/route.js`.
- **Belum ada pengiriman email atau WhatsApp otomatis.** Pelanggan memakai kode pemesanan dan halaman *Cek pesanan* (kode + nomor HP).
- **Pembatasan laju sudah aktif** (lihat bagian di bawah). Untuk perlindungan tambahan terhadap serangan besar, aktifkan juga Vercel Firewall.
- Ganti isi `payment_instructions` (rekening, e-wallet) di menu Pengaturan; nilai bawaan hanyalah contoh.

## Perlindungan dari penyalahgunaan

Hitungan disimpan di tabel `rate_limits` di Neon, jadi berlaku di semua server Vercel tanpa layanan tambahan.

| Aksi | Batas |
|---|---|
| Login admin | 8 percobaan per 15 menit per alamat IP, dan 15 per 15 menit per username. Login yang berhasil mereset hitungan. |
| Membuat pemesanan | 10 per 10 menit per alamat IP |
| Konfirmasi pembayaran | 20 per 10 menit per alamat IP |
| Pesanan menunggu bayar | Maksimal 3 per nomor HP (penjualan loket tidak dibatasi) |

Pengunjung yang melewati batas melihat pesan "Coba lagi dalam ... menit". Angkanya ada di `app/api/admin/login/route.js`, `app/api/bookings/route.js`, `app/api/bookings/[code]/pay/route.js`, dan `MAX_PENDING_PER_PHONE` di `lib/booking.js`.

## FAQ dan kebijakan di beranda

Isinya diatur di **Admin, Pengaturan**. Satu blok = satu pertanyaan (atau satu kebijakan): baris pertama judul, baris berikutnya isi, antar blok dipisah satu baris kosong. Kosongkan kolomnya untuk menyembunyikan bagian itu dari beranda. **Teks bawaan hanyalah contoh, sesuaikan dengan aturan perusahaan Anda**, terutama kebijakan pembatalan dan bagasi.

## Jadwal berulang dan salin jadwal

Di **Admin, Jadwal**:
- **Salin**: membuka formulir jadwal baru berisi data jadwal itu, tanggal sudah dimajukan satu hari.
- **Jadwal berulang**: pilih rute, bus, jam, harga, rentang tanggal (maksimal 92 hari), dan hari-hari berangkat. Pratinjau menampilkan jumlah jadwal yang akan dibuat. Jadwal yang sudah ada (bus dan waktu sama) dilewati, jadi aman dijalankan ulang.

## Memperbarui dari versi sebelumnya

Fitur pembatasan laju memakai satu tabel baru. Setelah memasang versi ini, jalankan sekali dari komputer Anda dengan `DATABASE_URL` yang sama:

```bash
npm run db:setup
```

Perintah ini aman diulang: tabel dan akun admin yang sudah ada tidak diubah. Bila dilewatkan, situs tetap berjalan tetapi pembatasan laju tidak aktif.

## Struktur

```
app/                 halaman (publik, /admin) dan API route
  api/admin/...      API admin (dilindungi middleware + pemeriksaan sesi)
  api/bookings/...   API publik untuk memesan dan konfirmasi bayar
components/          denah kursi, form pesan, komponen admin
lib/                 db (Neon), auth (JWT), logika booking, validasi CRUD
db/schema.sql        skema database
scripts/setup-db.mjs pembuat tabel, admin, dan data contoh
```

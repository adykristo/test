# KlinikFisikapku — Platform Pelatihan 12 Bulan

Versi ini mempertahankan sistem Member/Supabase yang sudah ada dan menambahkan fondasi pengelolaan pelatihan Olimpiade SD–SMP–SMA.

## Perubahan utama
- Fitur Tema/Dark Mode pada halaman Member dihapus.
- Registrasi tetap sekali; ditambah WhatsApp dan Kota/Kabupaten.
- Setelah login tanpa akses aktif, peserta memilih paket pada halaman aktivasi; pilihan paket sekarang disimpan ke database melalui `choose_member_package`.
- Admin tetap dapat mengelola peserta, paket/harga, pembayaran, modul, video, latihan, tryout, laporan, keamanan, dan admin.
- Ditambah menu **Bank Soal & Set Soal**.
- Bank Soal mendukung editor manual, filter, edit, duplikat, arsip, validasi, dan transfer soal terpilih ke Set Soal.
- Set Soal dibedakan dari Paket Pelatihan: `daily` untuk Latihan Harian dan `tryout` untuk Tryout Mingguan.
- Tiga metode yang sudah ada (Import Word, Tempel Soal+Gambar, Gemini AI) tetap dipertahankan sebagai alat penyusunan soal; hasil final sebaiknya diperiksa di Bank Soal sebelum publikasi.
- Ditambah tabel akses paket per peserta agar satu akun dapat memiliki riwayat paket lintas bulan.

## WAJIB sebelum fitur baru dipakai
Jalankan SQL berikut di Supabase SQL Editor **setelah setup produksi yang sudah ada**:

`MIGRASI-PLATFORM-PELATIHAN-12-BULAN.sql`

SQL ini bersifat migrasi tambahan dan tidak dimaksudkan untuk menghapus data peserta lama.

## File baru
- `admin-platform.js`
- `MIGRASI-PLATFORM-PELATIHAN-12-BULAN.sql`
- `README-PLATFORM-12-BULAN.md`

## Catatan produksi
Jangan menaruh `service_role` atau secret Gemini di frontend. Edge Function tetap digunakan untuk aksi AI/privileged yang memerlukan secret. Uji pada salinan/staging sebelum mengganti produksi.

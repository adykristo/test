# Fitur Baru Member Area

## Sudah siap dipakai setelah SQL diperbarui

- Dashboard peserta personal: progress, materi selesai, sisa hari akses, skor tryout terakhir, lanjut belajar, riwayat, bookmark, dan mode gelap.
- Progress, bookmark, riwayat tryout, transaksi, sertifikat, serta log admin tersimpan di Supabase dan dilindungi RLS.
- Panel admin baru: Transaksi dan Laporan (pendapatan, member aktif, rata-rata skor, CSV, log aktivitas).
- Aktivasi manual tetap tersedia. Mengubah transaksi menjadi `paid` dari admin akan mengaktifkan paket secara otomatis.
- Studio Soal AI untuk Latihan dan Tryout: input manual, PG/MCMA/kategori/isian/esai, impor Word/PDF, template Word dinamis, tempel teks+gambar, pratinjau draf, audit, variasi, solusi, dan analisis OSN.

## Langkah pembaruan

1. Cadangkan database Supabase.
2. Jalankan ulang seluruh `supabase-setup.sql` melalui SQL Editor. Skrip dibuat idempotent sehingga tabel lama tetap dipertahankan.
3. Unggah isi folder `member` ke hosting/GitHub Pages.
4. Uji dengan satu akun peserta dan satu akun admin.

## Mengaktifkan Gemini Studio Soal

1. Buat API key Gemini pada Google AI Studio.
2. Tambahkan Supabase Secret `GEMINI_API_KEY`.
3. Tambahkan `GEMINI_MODEL` sesuai model Gemini yang tersedia pada akun Anda.
4. Deploy Edge Function `gemini-question-studio`.
5. Buka Admin Member → Soal Latihan atau Tryout Mingguan, lalu uji satu soal terlebih dahulu.

API key Gemini hanya berada pada Supabase Edge Function dan tidak pernah ditulis ke HTML publik. Sistem membatasi 40 permintaan per akun admin per jam. Semua hasil AI masuk sebagai draf untuk ditinjau sebelum disimpan.

Format yang didukung:

- PG 4 opsi dan PG 5 opsi.
- PG kompleks/MCMA dengan lebih dari satu jawaban benar.
- PG kategori dengan label seperti Benar/Salah atau Sesuai/Tidak Sesuai.
- Isian singkat dan esai/rubrik.
- Rumus Word melalui Insert → Equation dikonversi ke LaTeX.
- Gambar dari Word atau clipboard dapat ikut dianalisis.
- PDF berbasis teks dapat diimpor; PDF hasil scan perlu ditempel sebagai gambar.

## Mengaktifkan pembayaran otomatis

Template Edge Function tersedia di `supabase/functions/create-payment` dan `supabase/functions/payment-webhook`.

1. Pilih Midtrans atau Xendit dan buat akun merchant.
2. Simpan secret melalui Supabase Secrets: `MIDTRANS_SERVER_KEY`, atau `XENDIT_SECRET_KEY` dan `XENDIT_CALLBACK_TOKEN`.
3. Deploy kedua Edge Function dengan Supabase CLI.
4. Atur URL webhook provider ke `payment-webhook?provider=midtrans` atau `payment-webhook?provider=xendit`.
5. Gunakan sandbox provider dan transaksi nominal kecil sebelum masuk produksi.

Secret key tidak boleh dimasukkan ke HTML, JavaScript publik, atau GitHub. Refund tetap dilakukan dari dashboard merchant; setelah itu status order dapat diselaraskan menjadi `refunded` di Admin Member.

## Fitur yang memerlukan layanan tambahan

- WhatsApp otomatis memerlukan akun Fonnte/Wablas/WhatsApp Cloud API dan Edge Function pengirim.
- Email otomatis dapat memakai Supabase Auth untuk email akun; email kampanye memerlukan penyedia email transaksi.
- Sertifikat sudah mempunyai tabel dan tampilan peserta. Pembuatan PDF otomatis memerlukan Edge Function/layanan PDF dan penyimpanan file.
- Batas perangkat perlu keputusan jumlah perangkat dan kebijakan reset perangkat sebelum diaktifkan.
# Pembaruan keamanan v4

Versi ini sekarang memakai koreksi jawaban di server, transaksi atomik, validasi webhook nominal + anti-replay, sanitasi anti-XSS, origin allowlist untuk Edge Function, MFA admin, idle timeout, dan Pusat Keamanan. Jalankan ulang `supabase-setup.sql`, deploy ulang Edge Function, lalu ikuti `PANDUAN-KEAMANAN-V4.md`.

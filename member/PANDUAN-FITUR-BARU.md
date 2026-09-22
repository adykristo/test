# Fitur Baru Member Area

## Sudah siap dipakai setelah SQL diperbarui

- Dashboard peserta personal: progress, materi selesai, sisa hari akses, skor tryout terakhir, lanjut belajar, riwayat, bookmark, dan mode gelap.
- Progress, bookmark, riwayat tryout, sertifikat, serta log admin tersimpan di Supabase dan dilindungi RLS.
- Panel admin Pembayaran Manual untuk mengubah bank, nomor rekening, nama pemilik, dan WhatsApp tanpa tabel baru.
- Peserta melihat rekening, menyalin nomor, lalu mengirim bukti pembayaran melalui WhatsApp. Aktivasi tetap dilakukan admin setelah bukti diperiksa.
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

## Mengatur pembayaran manual

1. Buka Admin Member → **Pembayaran Manual**.
2. Isi nama bank/metode, nomor rekening, nama pemilik rekening, dan nomor WhatsApp format `62`.
3. Tekan **Simpan Informasi Pembayaran**.
4. Login dengan akun peserta berstatus pending untuk memeriksa tampilan dan tombol WhatsApp.

Pengaturan disimpan sebagai entri internal pada tabel paket yang sudah ada. Entri tersebut disembunyikan dari pilihan paket sehingga tidak memerlukan perubahan SQL atau struktur Supabase.

## Fitur yang memerlukan layanan tambahan

- WhatsApp otomatis memerlukan akun Fonnte/Wablas/WhatsApp Cloud API dan Edge Function pengirim.
- Email otomatis dapat memakai Supabase Auth untuk email akun; email kampanye memerlukan penyedia email transaksi.
- Sertifikat sudah mempunyai tabel dan tampilan peserta. Pembuatan PDF otomatis memerlukan Edge Function/layanan PDF dan penyimpanan file.
- Batas perangkat perlu keputusan jumlah perangkat dan kebijakan reset perangkat sebelum diaktifkan.
# Pembaruan keamanan v4

Versi ini sekarang memakai koreksi jawaban di server, pembayaran manual dengan audit perubahan rekening, sanitasi anti-XSS, origin allowlist untuk Edge Function Gemini, MFA admin, idle timeout, dan Pusat Keamanan. Untuk perubahan pembayaran manual ini tidak perlu menjalankan SQL ulang; unggah file web terbaru lalu isi rekening dari halaman admin.

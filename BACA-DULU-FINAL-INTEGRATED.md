# KlinikFisikapku FINAL-INTEGRATED

## Arsitektur final
- **Member + Admin + data utama:** Supabase Auth/Postgres/RLS.
- **Mesin pembuatan soal:** Google Apps Script + Gemini.
- **Bank Soal:** Supabase `member_question_bank`.
- **Alur soal:** Google Script → Draft Supabase → Preview/Edit Manual → Validasi → Set Soal → Publish/Schedule → Member.
- **Latihan Harian:** pembahasan dapat dibuka setelah menjawab.
- **Tryout:** pembahasan dikunci sampai `explanation_release_at`.
- **Riwayat paket:** `member_package_access`, disinkronkan dari aktivasi Admin lama agar data tidak hilang.

## Urutan pemasangan
1. Backup database Supabase produksi.
2. Pastikan migrasi lama platform 12 bulan sudah dijalankan.
3. Jalankan `member/FINAL-INTEGRATED.sql` di Supabase SQL Editor.
4. Deploy folder `google-apps-script/` mengikuti `google-apps-script/SETUP-GOOGLE-SCRIPT.md`.
5. Tempel URL Web App `/exec` ke `member/google-script-config.js`.
6. Upload website ke staging/GitHub Pages dan uji dengan akun Admin + satu akun Member sebelum mengganti produksi.

## Rahasia yang TIDAK boleh di GitHub
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
Keduanya hanya disimpan di **Google Apps Script → Script Properties**.

## Yang sudah disatukan
- Import Word + Gemini, Tempel+Gambar+Gemini, dan Generator Gemini menggunakan Google Apps Script.
- Hasil AI disimpan otomatis sebagai **Draft** Bank Soal Supabase.
- Import Word tanpa AI dapat diperiksa lalu disimpan ke Bank Soal Supabase.
- Bank Soal: preview, edit manual, versi, duplikat, validasi, arsip.
- Set Soal: Latihan Harian/Tryout, paket, jadwal, durasi, waktu buka pembahasan, acak urutan soal, publish.
- Member Area membaca Set Soal terbit langsung dari Supabase.
- Koreksi Set Soal dilakukan server-side melalui RPC; kunci tidak dikirim saat daftar soal dimuat.
- Paket dapat dibuat dan diedit dari Admin beserta jenjang/jenis/bulan/prasyarat.
- Fitur tema/dark mode Member dihapus.

## Uji wajib sebelum produksi
1. Login Admin Supabase.
2. Buat 2 soal melalui Google Script dan pastikan muncul sebagai Draft di Bank Soal.
3. Edit manual + isi pembahasan + ubah status menjadi Tervalidasi.
4. Buat Set Latihan Harian, masukkan soal, jadwalkan, Publish.
5. Login Member paket yang sesuai; pastikan soal muncul dan pembahasan muncul setelah menjawab.
6. Buat Set Tryout; pastikan pembahasan terkunci sebelum `explanation_release_at`.
7. Aktivasi paket berikutnya untuk member yang sama dan cek riwayat `member_package_access`.

Catatan: `google-script-config.js` memang boleh publik karena hanya berisi URL Web App. Semua kunci rahasia tetap server-side.

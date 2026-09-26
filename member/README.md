# KlinikFisikapku Member Area — Paket GitHub Final

Paket ini menggabungkan web lama dengan backend Supabase Tahap Belajar 12 Bulan.

## Upload GitHub
Upload seluruh isi folder ini ke folder `member/` pada repository website lama. Jangan mengubah struktur file. `index.html` dan `admin.html` mengharapkan file Supabase JS berada di folder yang sama.

## Supabase
1. Backup database produksi.
2. Jalankan `supabase-setup-final.sql` di SQL Editor. File ini adalah setup/migrasi utama.
3. Buat/promosikan akun Super Admin sesuai komentar di bagian akhir SQL.
4. Deploy Edge Functions `admin-user-management` dan `gemini-question-studio` dari folder `supabase/functions/`.
5. Pasang secrets Edge Function sesuai panduan lama, termasuk `GEMINI_API_KEY`, `GEMINI_MODEL`, dan `ALLOWED_ORIGINS`.
6. Atur Site URL dan Redirect URLs Supabase Auth ke domain GitHub Pages/domain produksi.

## Catatan integrasi repository lama
`index.html` masih membaca `../data/pengaturan-situs.json` bila file itu tersedia; jika tidak tersedia, Member Area tetap berjalan. Tombol kembali Admin mengarah ke `../admin-dashboard-login.html`, sehingga file tersebut sebaiknya tetap ada di repository utama.

## Keamanan
Jangan pernah menaruh `service_role` key di file browser/GitHub. Service role hanya digunakan sebagai secret di Supabase Edge Functions.

File SQL lama dipindahkan ke `docs-legacy/` agar tidak salah dijalankan sebagai setup produksi.

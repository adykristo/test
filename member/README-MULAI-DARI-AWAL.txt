KLINIKFISIKAPKU MEMBER AREA — INSTALASI BERSIH

Paket ini dibuat agar form pendaftaran, Supabase Auth, trigger profil, dan tabel member memakai nama field yang sama.
Kota/Kabupaten tidak digunakan.

URUTAN:
1. BACKUP database jika ada data penting.
2. Jika benar-benar ingin mulai dari nol untuk data Member Area, jalankan 00-RESET-MEMBER-AREA.sql di Supabase SQL Editor.
   Skrip reset TIDAK menghapus auth.users, tetapi menghapus tabel public member_*.
3. Jalankan 01-INSTALL-DATABASE.sql sampai Success.
4. Jalankan 02-TAHAP-12-BULAN.sql sampai Success.
5. Isi supabase-config.js dengan Project URL + Publishable key dari PROJECT SUPABASE YANG SAMA dengan dashboard yang digunakan.
6. Upload index.html, supabase-config.js, supabase-auth.js (dan admin files bila dipakai) ke /member/ GitHub.
7. Authentication > URL Configuration:
   Site URL: https://klinikfisikapku.com/member/
   Redirect URL: https://klinikfisikapku.com/member/**
8. Authentication > Email: Enable Email + Confirm Email ON.
9. Custom SMTP: gunakan Brevo SMTP key aktif. DNS/domain dan Authorized IP harus sudah valid.
10. Tes dengan Gmail yang belum pernah terdaftar dan USERNAME BARU.

PENTING:
- Username unik. Paket V2 mengecek username SEBELUM signUp sehingga tidak lagi hanya menampilkan "Database error saving new user" saat username sudah dipakai.
- Password hanya disimpan oleh Supabase Auth.
- Jangan taruh service_role/secret key di GitHub.
- Jika memakai 00-RESET, user Auth lama tetap ada. Untuk pengujian paling bersih, gunakan Gmail baru atau hapus user TEST lama melalui Authentication > Users secara manual.

# KlinikFisikapku — Deploy Final

## Yang sudah dirapikan
- Login Admin Member tidak lagi memakai `prompt()` email/password browser.
- Super Admin dan Admin Konten dibaca dari `member_admins`.
- Admin Konten hanya diarahkan ke pengelolaan konten di UI.
- Edge Function `admin-user-management` diselaraskan dengan payload frontend.
- Buat, aktif/nonaktifkan, dan hapus Admin Konten memakai backend Supabase.
- RLS tetap aktif; service-role hanya digunakan di Edge Function.

## Deploy GitHub
Upload isi folder ini untuk mengganti isi repository produksi. File penting yang berubah:
- `member/supabase-admin.js`
- `member/admin.html`
- `member/supabase/functions/admin-user-management/index.ts` (source/reference deployment)

## Supabase SQL
Jalankan sekali `member/PRODUCTION-PATCH-ADMIN.sql` melalui SQL Editor.

## Supabase Edge Function
Deploy source `member/supabase/functions/admin-user-management/index.ts` sebagai function bernama tepat:
`admin-user-management`

Pastikan secret bawaan Supabase tersedia: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Jika `ALLOWED_ORIGINS` digunakan, isi minimal `https://klinikfisikapku.com`.

## Uji penerimaan
1. Buka Incognito dan akses `/member/admin.html`.
2. Pastikan muncul form Login Admin Member, bukan popup browser.
3. Login Super Admin: seluruh menu administratif tampil.
4. Buat Admin Konten, lalu cek muncul di Daftar Admin.
5. Logout, login sebagai Admin Konten: menu administratif sensitif tersembunyi; menu konten tersedia.
6. Tambah/edit satu konten percobaan lalu hapus kembali.
7. Login Super Admin dan tes Nonaktifkan/Aktifkan Admin Konten.
8. Tes Hapus hanya dengan akun percobaan; Super Admin harus tetap dilindungi.

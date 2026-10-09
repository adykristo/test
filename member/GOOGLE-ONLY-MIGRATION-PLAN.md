# Migrasi Google-only — rencana aman KlinikFisikapku

**Status:** belum diaktifkan di produksi. Tahap ini hanya menyembunyikan akun ditolak/diarsipkan dari Monitoring dan menyiapkan audit baca-saja.

## Kenapa tidak langsung mematikan email/password?
- `member/index.html` masih mendaftar melalui `api("daftar")` dan `auth.signUp({email,password})`.
- `member/supabase-auth.js` menolak Google OAuth baru tanpa profil dengan `username` dan `jenjang`. Google-only tanpa onboarding akan membuat pendaftaran gagal.
- Peserta lama mungkin memiliki ownership paket/progres yang terikat `auth.users.id`. Membuat user Google baru berpotensi menghasilkan ID berbeda. **Jangan migrasi dengan mencocokkan email saja.**
- Admin memakai `is_member_admin` sebagai pemeriksaan otorisasi; pemeriksaan ini harus dipertahankan.

## Urutan aman
1. Jalankan `member/sql/AUDIT-GOOGLE-ONLY-READONLY.sql` di Supabase. Catat agregat tanpa mengirim identitas peserta.
2. Audit trigger pembuat profil `auth.users`, kebijakan insert/update `member_profiles`, constraint username dan RPC pendaftaran.
3. Bangun onboarding Google baru yang hanya mengizinkan akun Google terverifikasi melengkapi biodata, tanpa akses berbayar sampai admin menyetujui. Gunakan `auth.uid()` di server dan jangan menerima user_id dari browser.
4. Uji peserta baru, peserta lama, admin, penolakan, dan transaksi dengan proyek TEST; pastikan ID auth lama tetap sama setelah identity linking.
5. Migrasikan peserta lama melalui `auth.linkIdentity({provider:"google"})` dari sesi akun mereka sendiri, verifikasi hasil di `auth.identities`; jangan membuat ulang profil, ownership atau progress.
6. Setelah seluruh akun lama siap dan alur baru diuji, ubah UI peserta/admin ke tombol Google saja, lalu nonaktifkan pendaftaran password baru di sisi server dengan pengaturan Supabase yang sesuai. Jangan menghapus Email Provider tanpa memastikan dampaknya terhadap peserta lama.
7. Pastikan pembatasan Google ditegakkan di sisi server (Supabase Auth/hook atau gerbang RPC dan RLS) untuk aplikasi, bukan sekadar menyembunyikan tombol. Google OAuth tetap membutuhkan pemeriksaan admin dan paket.

## Uji regresi wajib
- Google baru → profil belum lengkap → formulir biodata → pending → pilih paket → permintaan → persetujuan admin → ownership → latihan/tryout.
- Google lama terhubung → ID user, paket, progress, riwayat pembayaran tetap sama.
- Admin non-admin ditolak, admin Google aktif bisa masuk.
- Akun `ditolak` tidak masuk penghitung Monitoring; data tidak dihapus.
- Login password lama tetap tersedia selama migrasi, baru dihentikan setelah lolos semua pengujian.

**Jangan jalankan perubahan RLS atau nonaktifkan provider pada tahap ini.**

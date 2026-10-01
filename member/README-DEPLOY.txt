KLINIKFISIKAPKU — MEMBER AREA + V12 PACKAGE WORKFLOW

STRUKTUR FINAL
- admin.html: Admin Member Area.
  * Soal Latihan = pengelola paket latihan.
  * Tryout Mingguan = pengelola paket tryout.
  * Pembuat Soal V12 = menu terpisah di bawah Tryout Mingguan.
  * Bank V12 dapat mengirim seluruh paket atau soal terpilih ke Latihan / Tryout.
- pembuat-soal-klinikfisikapku-v12-final.html: V12 asli, tidak diubah.
- index.html: halaman peserta/member dan runner paket V15.
- supabase-publisher-v15.js: publikasi paket final ke kf_packages + kf_questions.
- supabase-data-v15.js: peserta memulai attempt, mengambil soal aman, menyimpan jawaban, submit, hasil.
- gas-workspace-bridge-v15.js: sinkron workspace V12 ke Google Apps Script/Sheets bila URL GAS diatur.

LANGKAH PASANG
1. Upload SEMUA file dalam ZIP ini ke folder website yang sama.
2. Di Supabase SQL Editor jalankan V15-INSTALL-SUPABASE-FINAL-AUDITED.sql.
3. Pastikan akun admin sudah dibuat di Supabase Authentication > Users.
4. Jalankan V15-SETUP-ADMIN-PERTAMA.sql.
5. supabase-config.js sudah diaktifkan (isValid: true) dan memakai publishable/anon key, bukan service_role.
6. Buka admin.html dan login admin.
7. Buka menu Pembuat Soal V12, buat/simpan paket di V12.
8. Di panel Kirim dari Bank V12 pilih → Paket Latihan atau → Paket Tryout.
9. Atur metadata paket lalu publikasikan ke Supabase.
10. Member aktif yang paket langganannya cocok akan melihat paket dari index.html.

CATATAN KEAMANAN
- Jangan pernah menaruh service_role/secret key di file browser.
- Kunci jawaban paket V15 tidak dibaca langsung oleh member; koreksi dilakukan melalui RPC server-side.

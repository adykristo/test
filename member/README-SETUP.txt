MEMBER AREA KLINIKFISIKAPKU — VERSI SUPABASE

PENTING: Panduan Apps Script di bawah ini adalah panduan versi lama.
Untuk versi pendaftaran Gmail, reset password email, paket manual, dan database
siswa terbaru, gunakan PANDUAN-SUPABASE-MEMBER.md dan supabase-setup.sql.
Jika database lama sudah ada, jalankan MIGRASI-PENDAFTARAN-BARU.sql satu kali.

ARSIP PANDUAN LAMA:

MEMBER AREA GEMINI — KLINIKFISIKAPKU

File yang dipakai
1. index-member.html  = halaman untuk member/peserta.
2. admin-member.html  = halaman admin Member Area yang terpisah.
3. Code.gs            = backend Google Apps Script + database Spreadsheet khusus Member Area.

Pemasangan
1. Buat satu Google Spreadsheet BARU khusus Member Area.
2. Pada Spreadsheet itu pilih Extensions > Apps Script, ganti isi file dengan Code.gs.
3. Di Code.gs isi SS_ID dan ADMIN_PASSWORD.
4. Di Apps Script buka Project Settings > Script properties > Add script property:
   Name: GEMINI_API_KEY
   Value: API key dari Google AI Studio (https://aistudio.google.com/app/apikey)
   Jangan masukkan key ini ke file HTML atau GitHub.
5. Deploy > New deployment > Web app.
   Execute as: Me. Who has access: Anyone.
6. Salin URL deployment yang berakhir /exec.
7. Tempel URL tersebut pada konstanta SCRIPT_URL di index-member.html dan admin-member.html.
8. Unggah index-member.html serta admin-member.html ke folder Member Area pada GitHub.
   Admin dibuka melalui URL admin-member.html dan tidak perlu ditautkan ke admin KlinikFisikapku utama.

Catatan keamanan
- Gunakan Spreadsheet dan Apps Script khusus Member Area agar database terpisah.
- Gunakan password admin yang panjang dan jangan bagikan URL admin kepada peserta.
- Gemini dipanggil dari Apps Script, sehingga API key tidak ikut terkirim ke browser peserta.
CATATAN KEAMANAN v4:
- Untuk pemasangan pertama, jalankan supabase-setup.sql. Pembaruan pembayaran manual tidak memerlukan SQL ulang.
- Jika memakai Studio Soal AI, deploy Edge Function gemini-question-studio dan isi ALLOWED_ORIGINS dengan domain produksi.
- Baca PANDUAN-KEAMANAN-V4.md sebelum menerima pembayaran sungguhan.
- Aktifkan MFA admin dari menu Keamanan, CAPTCHA, Confirm Email, dan Security Advisor.
PEMBARUAN HAK AKSES ADMIN
=========================
1. Admin Utama dapat menambahkan Admin Konten melalui menu Admin Pengelola.
   Admin Konten hanya dapat mengelola modul, latihan, video, dan tryout.
2. Jalankan ulang seluruh supabase-setup.sql agar trigger admin tunggal,
   role admin, status publikasi, arsip, dan riwayat versi konten terpasang.
3. Aktifkan MFA dari menu Admin > Keamanan sebelum dipakai secara resmi.
4. Konten AI disimpan sebagai DRAF. Periksa lalu klik Terbitkan.
5. Tombol Arsipkan tidak menghapus permanen; konten dapat dipulihkan sebagai draf.
6. Email dan WhatsApp peserta disamarkan pada data yang dikirim ke dashboard admin.
7. Sebelum produksi ubah testMode dan demoMode menjadi false di supabase-config.js.
8. Deploy Edge Function admin-user-management dan gemini-question-studio.

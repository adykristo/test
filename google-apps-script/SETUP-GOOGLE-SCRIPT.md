# Setup Google Apps Script — Mesin Soal KlinikFisikapku

1. Buat project baru di script.google.com dan salin `Code.gs` + `appsscript.json`.
2. Project Settings → Script Properties, isi:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (RAHASIA; hanya di Script Properties, jangan di GitHub/HTML)
   - `GEMINI_API_KEY` (RAHASIA)
   - `GEMINI_MODEL` opsional, default `gemini-2.5-flash`.
3. Deploy → New deployment → Web app → Execute as Me → akses sesuai akun yang akan memakai Admin.
4. Salin URL `/exec` ke `member/google-script-config.js`.
5. Jalankan `member/FINAL-INTEGRATED.sql` di Supabase.

Browser Admin mengirim JWT sesi Supabase. Apps Script memverifikasi bahwa JWT milik Admin aktif, memanggil Gemini, lalu menyimpan hasil sebagai `draft` ke `member_question_bank` di Supabase. Service-role key dan Gemini key tidak pernah dikirim ke browser.

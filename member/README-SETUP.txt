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

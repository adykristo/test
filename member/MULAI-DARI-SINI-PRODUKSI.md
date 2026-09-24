# Member Area KlinikFisikapku — Paket Produksi

Paket ini sudah diarahkan ke:

- Situs: `https://klinikfisikapku.com/member/`
- Proyek Supabase: `spxprgwkpjkusnoviofi`
- Mode demo dan mode uji coba: **nonaktif**

## 1. File yang diunggah ke GitHub

Unggah **seluruh isi folder `member`** ke folder `member` di repositori situs. Struktur pentingnya:

```text
member/
├── index.html
├── admin.html
├── admin-member.html
├── index-member.html
├── privacy.html
├── terms.html
├── supabase-config.js
├── supabase-auth.js
├── supabase-admin.js
├── demo-data.js
├── supabase-setup.sql
└── supabase/functions/
```

Jangan mengunggah file ZIP ke dalam folder situs. Ekstrak ZIP dahulu, lalu unggah isi folder `member`.

## 2. Urutan pemasangan

1. Unggah semua file ke GitHub.
2. Pastikan hosting menayangkan `https://klinikfisikapku.com/member/`.
3. Di Supabase SQL Editor jalankan seluruh isi `supabase-setup.sql` satu kali.
4. Buat atau pastikan akun admin utama sudah ada di Authentication > Users.
5. Jalankan SQL berikut di SQL Editor:

```sql
insert into public.member_admins(user_id, role, display_name, active)
select id, 'super_admin', 'Ady Kristo Naibaho', true
from auth.users
where lower(email) = lower('adykristo@gmail.com')
on conflict (user_id) do update
set role = 'super_admin',
    display_name = excluded.display_name,
    active = true;
```

6. Deploy Edge Function `admin-user-management` agar admin utama dapat menambah admin konten.
7. Deploy Edge Function `gemini-question-studio` jika fitur AI akan dipakai.
8. Tambahkan secret `GEMINI_API_KEY`, `GEMINI_MODEL`, dan `ALLOWED_ORIGINS` di Supabase. Jangan simpan secret di GitHub.
9. Di Authentication > URL Configuration atur:
   - Site URL: `https://klinikfisikapku.com/member/`
   - Redirect URL: `https://klinikfisikapku.com/member/**`
10. Aktifkan Email dan/atau Google Provider sesuai metode login yang digunakan.

## 3. Alamat halaman

- Peserta: `https://klinikfisikapku.com/member/`
- Admin member: `https://klinikfisikapku.com/member/admin.html`
- Pengalihan admin lama: `https://klinikfisikapku.com/member/admin-member.html`

## 4. Pemeriksaan sebelum dipakai

- Daftar menggunakan satu akun peserta baru.
- Login peserta yang belum aktif harus berhenti di halaman paket/pembayaran.
- Kirim bukti pembayaran melalui tombol WhatsApp.
- Login admin utama, aktifkan peserta, dan pilih paketnya.
- Login ulang sebagai peserta; dashboard belajar harus terbuka.
- Tambahkan satu admin konten dan pastikan ia hanya dapat mengelola modul, video, soal latihan, dan tryout.
- Buat satu paket, satu modul, satu video, satu soal latihan, dan satu tryout; periksa tampilannya dari akun peserta.
- Pastikan anon key/publishable key boleh berada di browser, tetapi service-role key, password SMTP, dan API key AI tidak pernah dimasukkan ke GitHub.

## 5. Catatan video

Peserta melihat pemutar video, bukan kolom URL sumber. Namun URL jaringan tidak dapat disembunyikan mutlak dari pengguna yang memakai alat pengembang browser. Untuk perlindungan lebih kuat gunakan layanan video privat dengan signed URL atau DRM.

## 6. Jika belum siap menghubungkan Supabase

Gunakan paket demo yang terpisah. Jangan mengubah `demoMode` atau `testMode` menjadi `true` pada paket produksi ini.

# Pemasangan Supabase — Member Area KlinikFisikapku

Paket ini menyiapkan pendaftaran terbuka memakai Gmail, verifikasi email, login, reset password, profil siswa, pemilihan paket setelah login, aktivasi manual oleh admin, konten belajar, dan daftar peserta di Admin Member.

## 1. Buat proyek Supabase

1. Buka `https://supabase.com` dan masuk.
2. Pilih **New project**.
3. Isi nama proyek, misalnya `klinikfisikapku-member`.
4. Buat password database yang kuat dan simpan sendiri.
5. Pilih region terdekat, kemudian tunggu proyek selesai dibuat.

## 2. Buat tabel dan pengaman database

1. Di dashboard Supabase buka **SQL Editor**.
2. Pilih **New query**.
3. Salin seluruh isi `supabase-setup.sql`.
4. Klik **Run** dan pastikan tidak ada pesan error.

File SQL mengaktifkan Row Level Security. Peserta hanya bisa membaca profilnya sendiri dan konten untuk member aktif. Admin Utama mengelola seluruh sistem, sedangkan Admin Konten hanya mengelola materi belajar.

### Jika database lama sudah terpasang

Jangan menghapus tabel. Jalankan isi `MIGRASI-PENDAFTARAN-BARU.sql` satu kali melalui SQL Editor. Migrasi menambahkan `username`, `kelas`, dan fungsi pemilihan paket tanpa menghapus data lama.

## 3. Atur alamat website untuk email

Di **Authentication → URL Configuration**:

- Site URL: `https://klinikfisikapku.com/member/`
- Tambahkan Redirect URL: `https://klinikfisikapku.com/member/`
- Tambahkan Redirect URL: `https://klinikfisikapku.com/member/?mode=reset-password`

Pastikan login Email aktif. Supabase akan mengirim email verifikasi dan reset password.

## 4. Ambil konfigurasi publik

Di **Project Settings → API** salin:

- Project URL
- Publishable key (atau `anon public` key pada tampilan lama)

Buka `supabase-config.js`, lalu ganti dua teks `GANTI_...` dengan nilai tersebut. Publishable/anon key boleh berada di frontend karena akses data dibatasi RLS.

Jangan memasukkan **Secret key** atau **service_role key** ke HTML/JavaScript/GitHub.

## 5. Jadikan akun sebagai Admin Member

1. Daftar satu akun melalui `https://klinikfisikapku.com/member/` menggunakan email admin.
2. Klik tautan verifikasi yang dikirim ke email.
3. Di Supabase buka **SQL Editor**, lalu jalankan:

```sql
insert into public.member_admins(user_id,role,display_name,active)
select id from auth.users
where email = 'GANTI_DENGAN_EMAIL_ADMIN'
on conflict do nothing;
```

4. Buka `https://klinikfisikapku.com/member/admin.html` dan masuk menggunakan email tersebut.

## 6. Deploy fungsi pengelolaan admin

Folder `supabase/functions/admin-user-management` harus dideploy sebagai Edge Function. Fungsi ini membuat akun Auth Admin Konten secara aman menggunakan service role yang hanya tersedia di lingkungan Supabase dan tidak pernah dikirim ke browser.

Jika memakai Supabase CLI:

```bash
supabase functions deploy admin-user-management
supabase functions deploy gemini-question-studio
supabase secrets set ALLOWED_ORIGINS=https://klinikfisikapku.com
```

Setelah fungsi aktif, buka menu **Admin Pengelola** pada halaman admin. Isi nama, email, dan password sementara. Admin baru otomatis mendapat peran `content_admin`.

Admin Konten hanya dapat membuka Modul, Soal Latihan, Video Pembahasan, dan Tryout. Pembatasan ini juga diterapkan oleh RLS, sehingga membuka URL atau menjalankan JavaScript sendiri tetap tidak memberi akses ke data peserta maupun pembayaran.

## 7. Atur pembayaran manual

1. Di Admin Member buka **Pembayaran Manual**.
2. Isi nama bank/metode, nomor rekening, nama pemilik rekening, dan WhatsApp tujuan.
3. Simpan, lalu uji memakai satu akun peserta berstatus `pending`.

Data pembayaran memakai tabel paket yang sudah dibuat oleh skrip awal. Tidak perlu membuat tabel, policy, atau menjalankan SQL tambahan.

## 8. Unggah ke GitHub

Unggah seluruh isi folder `member` dari paket ini ke folder `member` pada repository. Timpa file lama dengan nama yang sama dan jangan hapus data web utama.

## Mode uji coba sementara

Pada `supabase-config.js`, nilai `testMode: true` menampilkan tombol **Buka Dashboard Uji Coba**. Tombol ini memakai data contoh sehingga aman dibuka dari file lokal dan tidak memberikan akses ke data member Supabase.

Sebelum web resmi digunakan, ubah menjadi:

```javascript
testMode: false
```

Setelah dinonaktifkan, dashboard asli hanya dapat dibuka oleh akun berstatus `aktif` yang telah disetujui admin.

## Alur pemakaian

1. Siswa mendaftar menggunakan Gmail, nama, sekolah, kelas, username, dan password.
2. Siswa memverifikasi email.
3. Profil siswa otomatis tercatat dengan status `pending`.
4. Semua akun terdaftar dapat login, tetapi akun yang belum aktif hanya melihat halaman pilihan dan pembayaran paket.
5. Siswa memilih paket, mentransfer pembayaran, lalu mengirim bukti melalui WhatsApp.
6. Admin memeriksa bukti dan mengaktifkan siswa. Dashboard belajar tetap dikunci sampai status berubah menjadi `aktif`.
7. Siswa login dan melihat materi sesuai jenjang.
8. Jika lupa password, siswa memilih **Lupa password?** dan menerima tautan melalui email.

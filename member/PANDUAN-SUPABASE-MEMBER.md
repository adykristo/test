# Pemasangan Supabase — Member Area KlinikFisikapku

Paket ini sudah menyiapkan pendaftaran email, verifikasi email, login, login Google, reset password melalui email, profil siswa, status member, paket, konten, dan daftar peserta di Admin Member.

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

File SQL mengaktifkan Row Level Security. Peserta hanya bisa membaca profilnya sendiri dan konten untuk member aktif. Admin yang terdaftar dapat mengelola seluruh data Member.

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
insert into public.member_admins(user_id)
select id from auth.users
where email = 'GANTI_DENGAN_EMAIL_ADMIN'
on conflict do nothing;
```

4. Buka `https://klinikfisikapku.com/member/admin.html` dan masuk menggunakan email tersebut.

## 6. Atur pembayaran manual

1. Di Admin Member buka **Pembayaran Manual**.
2. Isi nama bank/metode, nomor rekening, nama pemilik rekening, dan WhatsApp tujuan.
3. Simpan, lalu uji memakai satu akun peserta berstatus `pending`.

Data pembayaran memakai tabel paket yang sudah dibuat oleh skrip awal. Tidak perlu membuat tabel, policy, atau menjalankan SQL tambahan.

## 7. Aktifkan tombol Google (opsional)

Di **Authentication → Providers → Google**, aktifkan Google lalu ikuti petunjuk Client ID dan Client Secret dari Google Cloud. Masukkan Callback URL yang ditampilkan Supabase ke Authorized redirect URI di Google Cloud.

Jika Google belum dikonfigurasi, pendaftaran email/password dan reset password tetap dapat digunakan.

## 8. Unggah ke GitHub

Unggah seluruh isi folder `member` dari paket ini ke folder `member` pada repository. Timpa file lama dengan nama yang sama dan jangan hapus data web utama.

## Alur pemakaian

1. Siswa mendaftar menggunakan email dan melengkapi data sekolah.
2. Siswa memverifikasi email.
3. Profil siswa otomatis tercatat dengan status `pending`.
4. Siswa mentransfer pembayaran dan mengirim bukti melalui WhatsApp dari halaman status akun.
5. Admin memeriksa bukti, membuka **Pendaftaran Baru**, memilih paket, lalu mengaktifkan siswa.
6. Siswa login dan melihat materi sesuai jenjang.
7. Jika lupa password, siswa memilih **Lupa password?** dan menerima tautan melalui email.

# Panduan Keamanan v4 — Member Area KlinikFisikapku

Tidak ada situs yang dapat dijamin 100% bebas peretasan. Versi ini menerapkan *defense in depth*: bila satu lapisan gagal, RLS, fungsi server, verifikasi pembayaran manual, sanitasi tampilan, MFA, dan audit masih membatasi dampaknya.

## Peningkatan yang sudah ada di kode

- Kunci, pembahasan, dan kunci pernyataan kategori tidak dikirim bersama daftar soal. Koreksi dilakukan oleh `check_member_answer()` di database.
- Tabel konten mentah hanya dapat dibaca admin. Member aktif mendapat materi jenjangnya melalui `member_secure_content()`.
- Status aktif tidak pernah dipercaya dari `localStorage`; setiap buka halaman diverifikasi ulang melalui sesi Supabase.
- Semua teks soal, opsi, judul, tautan PDF, gambar, dan sertifikat divalidasi/di-*escape* sebelum dirender untuk mengurangi stored-XSS.
- Edge Function hanya menerima origin yang diizinkan, metode POST, dan payload berukuran terbatas.
- Gemini hanya dapat dipakai admin, maksimal 40 permintaan/jam, dengan batas ukuran teks/gambar/hasil.
- Admin memiliki Pusat Keamanan, MFA TOTP, keluar semua perangkat, dan *idle timeout* 30 menit.
- Operasi sensitif dicatat di `member_admin_logs`, termasuk perubahan rekening pembayaran oleh admin.

## Instalasi / upgrade wajib

1. Buat backup database.
2. Jalankan ulang seluruh `supabase-setup.sql` di SQL Editor. File bersifat idempotent dan bagian hardening berada di akhir.
3. Pastikan akun admin masih tercatat pada `member_admins`.
4. Deploy ulang Edge Function `gemini-question-studio` bila memakai Studio Soal AI.
5. Isi Secrets berikut. Jangan pernah menaruh nilainya di HTML atau GitHub:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=...
ALLOWED_ORIGINS=https://domain-anda.com,https://www.domain-anda.com
```

## Pengaturan Dashboard Supabase

- Authentication → aktifkan **Confirm email**.
- Authentication → Attack Protection → aktifkan **CAPTCHA** (Turnstile/hCaptcha) untuk daftar, login, reset, dan Magic Link.
- Pertahankan rate limit Auth yang ketat dan gunakan SMTP produksi.
- URL Configuration → hapus wildcard/localhost di produksi; masukkan hanya URL situs dan URL reset password yang diperlukan.
- Matikan provider login yang tidak dipakai.
- Jalankan Database **Security Advisor** dan **Performance Advisor** setelah perubahan skema.
- Simpan `service_role` dan kunci Gemini hanya sebagai Supabase Secrets.

## Wajibkan MFA untuk admin (setelah MFA terdaftar)

Masuk ke Admin → **Keamanan** → **Aktifkan MFA Authenticator**. Setelah berhasil dan diuji dengan login ulang, jalankan SQL berikut agar seluruh kebijakan admin mensyaratkan AAL2:

```sql
create or replace function public.is_member_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal','')='aal2'
    and exists(select 1 from public.member_admins a where a.user_id=auth.uid());
$$;
```

Jangan menjalankan SQL tersebut sebelum MFA admin berhasil didaftarkan, atau operasi admin akan terkunci sampai sesi AAL2 tersedia.

## Header hosting

Meta CSP sudah disertakan, tetapi header HTTP lebih kuat. Terapkan isi `SECURITY-HEADERS.txt` melalui Cloudflare/hosting. Untuk `Content-Security-Policy`, uji di *Report-Only* dahulu agar CDN PDF/Word/MathJax tidak terblokir tanpa terlihat.

Batasi `/member/admin.html` dengan Cloudflare Access atau lapisan autentikasi hosting bila tersedia. Aktifkan 2FA, secret scanning, dan branch protection pada akun GitHub/hosting.

## Uji sebelum produksi

1. Login member kedaluwarsa harus gagal memuat materi.
2. DevTools → Network: respons `member_secure_content` tidak boleh berisi `kunci`, `pembahasan`, atau `statements[].key`.
3. Soal PG, MCMA, kategori, isian, dan esai harus mendapat pembahasan hanya setelah dikirim.
4. Member tidak boleh mengubah `member_progress.selesai` atau membaca konten mentah melalui REST.
5. Ubah rekening dari Admin → Pembayaran Manual dan pastikan data baru tampil pada akun pending.
6. Uji tombol salin rekening dan pesan WhatsApp pada ponsel.
7. Uji string `<img src=x onerror=alert(1)>` pada judul/soal; tidak boleh mengeksekusi JavaScript.
8. Login admin dengan MFA, tunggu idle timeout, dan uji tombol keluar semua perangkat.
9. Jalankan Security Advisor dan periksa log Edge Function Gemini setelah pengujian AI.

## Operasional rutin

- Backup harian dan uji pemulihan backup secara berkala.
- Tinjau login admin, perubahan rekening, lonjakan pendaftaran, dan penggunaan AI setiap minggu.
- Putar secret segera bila ada indikasi bocor.
- Perbarui dependensi CDN secara terjadwal; jangan memakai URL paket tanpa versi.
- Audit hak admin setiap bulan dan hapus akun yang tidak lagi bertugas.

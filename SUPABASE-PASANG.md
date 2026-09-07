# Supabase KlinikFisikapku — Tahap Integrasi 1

File `supabase-config.js` sudah berisi Project URL dan Publishable Key. Keduanya boleh berada di GitHub karena RLS sudah aktif. Jangan menambahkan `sb_secret_...` atau password database.

## Yang sudah terhubung

- Library browser Supabase dimuat dari CDN.
- Client Supabase tersedia sebagai `window.kfSupabase` untuk halaman peserta maupun admin.
- Sesi Supabase disimpan aman di browser peserta.

## Tahap berikutnya

Pindahkan fungsi satu per satu dengan Edge Function: pendaftaran WhatsApp/password, aktivasi admin, materi privat, paket tryout, autosimpan jawaban, penilaian esai, lalu sertifikat. Jangan menghapus Apps Script sebelum semua fungsi diuji.

## Pengujian cepat di browser

Buka halaman web lalu tekan F12 > Console dan jalankan:

```js
window.kfSupabaseReady
```

Hasil `true` berarti konfigurasi browser tersambung.

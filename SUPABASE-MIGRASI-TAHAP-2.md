# Migrasi mudah ke Supabase

1. Buka **Supabase → SQL Editor → New query**.
2. Buka file `supabase/migrasi-tryout-tahap2.sql`, salin seluruh isinya, lalu klik **Run** satu kali.
3. Di menu **Edge Functions**, buat/deploy fungsi bernama `tryout-api` dari folder `supabase/functions/tryout-api`.
4. Di menu **Edge Functions → Secrets**, buat `SUPABASE_SERVICE_ROLE_KEY`. Ambil nilainya dari Settings → API → Secret key. Jangan pernah dimasukkan ke GitHub atau file web.
5. Setelah tahap ini berhasil, baru aktifkan perpindahan modul tryout satu per satu. Apps Script tetap berjalan sebagai cadangan selama masa transisi.

## Urutan migrasi aman

- Tahap 1: login peserta, progres/favorit, riwayat belajar.
- Tahap 2: autosave jawaban tryout ke Supabase.
- Tahap 3: submit, penilaian objektif, hasil, dan sertifikat dari Edge Function.
- Tahap 4: nilai esai dan dashboard admin.

Jangan memindahkan kunci jawaban, `ADMIN_KEY`, password database, atau Secret key ke GitHub.

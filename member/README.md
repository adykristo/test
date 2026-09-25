# Member Area KlinikFisikapku (Supabase + Tahap Belajar 12 Bulan)

Paket siap upload ke hosting (`/member/`) dan setup di Supabase.

## Isi folder

| File | Fungsi |
|------|--------|
| `index.html` | Halaman siswa / Member Area |
| `admin.html` | Halaman Admin Member |
| `supabase-config.js` | URL + anon key Supabase (**wajib diisi**) |
| `supabase-auth.js` | Auth & konten aman (siswa) |
| `supabase-admin.js` | API admin |
| `supabase-setup.sql` | Setup database utama (jalankan **pertama**) |
| `supabase-tahap-belajar-12-bulan.sql` | Migrasi tahap 1–12 (jalankan **kedua**) |
| `MIGRASI-PENDAFTARAN-BARU.sql` | Opsional jika upgrade dari skema lama |
| `supabase/functions/*` | Edge Functions (Gemini + admin) |
| `privacy.html` / `terms.html` | Kebijakan |

## Setup Supabase (urutan wajib)

1. Buka **SQL Editor** di project Supabase.
2. Jalankan seluruh isi `supabase-setup.sql`.
3. Jalankan seluruh isi `supabase-tahap-belajar-12-bulan.sql`.
4. (Opsional) `MIGRASI-PENDAFTARAN-BARU.sql` hanya jika database lama.
5. **Authentication → Providers**: aktifkan Email.
6. **Authentication → URL Configuration**: tambahkan URL site Anda (mis. `https://klinikfisikapku.com`).
7. Buat user admin di Auth, lalu masukkan ke tabel `member_admins` dengan `role = 'super_admin'`.

Contoh insert admin (ganti UUID user Auth):

```sql
insert into public.member_admins (user_id, role)
values ('UUID-USER-AUTH-ADMIN', 'super_admin')
on conflict (user_id) do update set role = 'super_admin';
```

8. Deploy Edge Functions (opsional, untuk Studio Soal AI & kelola Admin Konten):

```bash
# Dari folder project yang berisi supabase/functions/
supabase functions deploy gemini-question-studio --no-verify-jwt
supabase functions deploy admin-user-management --no-verify-jwt
```

Secrets (Dashboard → Edge Functions → Secrets, atau CLI):

| Secret | Wajib | Contoh |
|--------|-------|--------|
| `GEMINI_API_KEY` | Ya (untuk AI) | kunci dari Google AI Studio |
| `GEMINI_MODEL` | Ya (untuk AI) | `gemini-2.0-flash` |
| `ALLOWED_ORIGINS` | Disarankan | `https://klinikfisikapku.com` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` biasanya otomatis tersedia di runtime Edge Function.

**Catatan:** `admin-user-management` siap di backend, tetapi UI "Admin Pengelola" belum ada di `admin.html` saat ini. Untuk membuat Super Admin cukup lewat SQL.


## Setup file di hosting

1. Edit `supabase-config.js`:
   - `url` → Project URL
   - `anonKey` → **anon/public** key (bukan service_role)
   - `demoMode: false`, `testMode: false`
2. Upload seluruh isi folder ini ke `https://domain-anda/member/`.
3. Pastikan path admin login mengarah ke `../admin-dashboard-login.html` sesuai struktur site Anda.

## Fitur Tahap Belajar 12 Bulan

- Setiap konten (modul, soal, video, tryout) punya **Tahap 1–12**.
- Setiap peserta punya **tahap_terbuka** (0–12).
- Peserta hanya melihat konten dengan `learning_stage ≤ tahap_terbuka`.
- Saat admin **mengaktifkan paket**, tahap naik otomatis (~1 tahap per 30 hari paket).
- Admin bisa **atur tahap manual** lewat tombol **Tahap** di daftar member.

## Keamanan yang sudah diterapkan

- Kunci jawaban & pembahasan hanya lewat RPC server (`check_member_answer`).
- Konten soal disaring di SQL (`member_secure_content`) — kunci tidak dikirim ke browser sebelum lulus cek.
- Admin list member memakai data bertopeng (email/WA disamarkan).
- CSP header di HTML; `service_role` **tidak** boleh ada di file frontend.
- Hanya Super Admin (`member_admins.role = 'super_admin'`) yang mengakses `admin.html`.

## Alur uji singkat

1. Daftar akun Gmail baru → status pending → halaman pembayaran.
2. Login sebagai Super Admin → **Pendaftaran Baru** → Aktifkan + pilih paket.
3. Tambah modul/soal dengan **Tahap 1**, login peserta → materi tampil.
4. Set tahap peserta ke 0 → materi tahap 1 hilang; set ke 1 → muncul lagi.

## Catatan GitHub

- Jangan commit `service_role` key.
- `anonKey` bersifat public by design (dilindungi RLS).
- Jika repo publik, tetap aman selama RLS & RPC benar.

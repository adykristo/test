# Audit pemetaan paket & sertifikat V15 (CSV 50) — 11 Oktober 2026

Sumber: `Supabase Snippet Untitled query (50).csv`, 44 kolom dari 4 tabel; metadata `information_schema.columns`, bukan isi data.

| Tabel | Kolom penting |
|---|---|
| `kf_packages` | id uuid, external_id, kind, name, jenjang, kelas, mapel, subscription, duration_minutes, visible, published_at, review_status |
| `kf_package_access` | kf_package_id uuid, member_package_id uuid, topic_id uuid, subtopic_id uuid |
| `kf_certificates` | id uuid, user_id uuid, member_package_id uuid, certificate_number, package_name, issued_at, qualification_snapshot jsonb |
| `kf_v15_package_certificates` | id, user_id, jenjang, package_no, published_result_id, certificate_number, verification_token, issued_at, revoked_at, replaced_by |

## Temuan kritis
- Sudah ada sistem sertifikat lama `kf_certificates` yang mengacu langsung ke `member_package_id`. Mengaktifkan `kf_v15_package_certificates` tanpa strategi migrasi/integrasi dapat menduplikasi penerbitan.
- `kf_packages` tampaknya merepresentasikan paket/asesmen soal; `kf_package_access` memetakan ke paket peserta melalui `member_package_id`.
- Tabel baru menggunakan `jenjang + package_no`, sementara sertifikat lama menggunakan UUID `member_package_id`. **Belum ada bukti mapping tepat**, jangan mengasumsikan nama/nomor paket sama.
- Audit `information_schema.columns` menggunakan filter nama tabel sehingga mungkin melewatkan tabel bernama lain. Temukan tabel dengan kolom `member_package_id` dan definisi FK sebelum menulis RPC.
- Tidak ada perubahan database produksi dalam audit ini.

## Query berikut read-only
```sql
SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
WHERE c.table_schema='public'
  AND (c.column_name='member_package_id'
       OR c.table_name IN ('member_packages','kf_member_packages','kf_package_access','kf_certificates'))
ORDER BY c.table_name, c.ordinal_position;
```

Audit juga constraint FK untuk `kf_package_access`, `kf_certificates`, dan `kf_packages`. Pertimbangkan memakai tabel `kf_certificates` yang sudah ada, ditambah informasi published result / QR jika benar cocok, alih-alih dua sumber kebenaran sertifikat.

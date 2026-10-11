# Integrasi paket dan sertifikat V15 — hasil CSV (51)

Sumber: file pengguna `Supabase Snippet Untitled query (51).csv`, 25 baris struktur kolom.

## Pemetaan terkonfirmasi pada tingkat skema
- `member_packages`: `id`, `nama`, `kode`, `urutan`, `jenjang`, `aktif`.
- `kf_package_access`: `kf_package_id`, `member_package_id`, `topic_id`, `subtopic_id`.
- `kf_certificates`: `user_id`, `member_package_id`, `certificate_number`, `package_name`, `qualification_snapshot`.
- `kf_v15_package_certificates`: `user_id`, `jenjang`, `package_no`, `published_result_id`, `verification_token`, `revoked_at`.

## Keputusan rancangan
**Sumber kebenaran paket pelatihan adalah `member_packages.id`, bukan nomor paket saja.**
`kf_attempts.package_id` → `kf_packages.id` → `kf_package_access.kf_package_id` → `kf_package_access.member_package_id` → `member_packages.id`.
Pemetaan dapat berisi banyak `kf_packages` untuk satu `member_packages`; harus menghitung seluruh asesmen yang diwajibkan, bukan satu attempt.

Sistem sertifikat lama `kf_certificates` **tidak boleh diabaikan**; sebelum penerbitan baru harus diperiksa apakah sudah ada sertifikat peserta + member_package_id. Jangan terbitkan sekaligus di dua tabel sebelum strategi migrasi/bridge diputuskan.

## Pemeriksaan data baca-saja untuk memastikan pemetaan paket
```sql
SELECT mp.id AS member_package_id,mp.nama,mp.kode,mp.urutan,mp.jenjang,
       count(DISTINCT pa.kf_package_id) AS linked_assessments
FROM public.member_packages mp
LEFT JOIN public.kf_package_access pa ON pa.member_package_id=mp.id
GROUP BY mp.id,mp.nama,mp.kode,mp.urutan,mp.jenjang
ORDER BY mp.jenjang,mp.urutan,mp.nama;
```

## Persiapan pengujian preview bobot
```sql
-- HANYA setelah migrasi DRAFT_v15_admin_weighted_preview.sql diuji di staging.
-- Panggil melalui Supabase client dengan sesi super_admin, jangan melalui SQL editor
-- sebab auth.uid() SQL editor biasa bukan pengguna admin.
-- client.rpc('kf_admin_preview_weighted_score_v15', {
--   p_attempt: '<valid submitted attempt uuid>',
--   p_weights: {pg4:40,esai:60}
-- })
```

**Tidak ada migrasi produksi otomatis.** RLS dan izin RPC harus diuji dengan admin/peserta terlebih dahulu.

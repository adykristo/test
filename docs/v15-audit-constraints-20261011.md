# Audit constraint V15 — 11 Oktober 2026

Sumber: CSV ekspor Supabase pengguna `Supabase Snippet Untitled query (46).csv`, 90 baris dari `information_schema.table_constraints`. **Audit hanya metadata, bukan uji fungsional.**

## Terkonfirmasi
- `kf_answers`: FK `attempt_id`, FK `question_id`, UNIQUE (`attempt_id`,`question_id`).
- `kf_attempts`: FK `package_id`, FK `user_id`, UNIQUE (`package_id`,`user_id`,`attempt_no`).
- `kf_essay_manual_grades`: PK sekaligus FK `answer_id`, beberapa CHECK skor.
- `kf_questions`: FK `package_id`, UNIQUE (`package_id`,`position`).
- `kf_v15_grading_policies`: UNIQUE `assessment_key`, CHECK `passing_score`, `version`, `weights`.
- `kf_v15_published_results`: FK `user_id`, `published_by`, `supersedes_id`; CHECK skor dan versi.
- `kf_v15_package_certificates`: FK `user_id`, `published_result_id`, `replaced_by`; UNIQUE `certificate_number`, `verification_token`; CHECK jenjang dan nomor paket.

## Temuan dan tindakan sebelum penulisan data
1. **Tidak ada FK `kf_v15_published_results.attempt_id` pada ekspor**. Jangan langsung tambahkan FK tanpa memeriksa tipe, data historis, dan kebijakan relasi. Perlu validasi bahwa `user_id` di hasil cocok dengan `kf_attempts.user_id` (FK tunggal tidak cukup).
2. **Tidak terlihat UNIQUE constraint `attempt_id` untuk hasil resmi**, tetapi mungkin ada partial unique index yang tidak terdaftar di `information_schema.table_constraints`. Periksa `pg_indexes`.
3. **Tidak terlihat UNIQUE constraint per peserta/jenjang/paket untuk sertifikat aktif**, tetapi mungkin ada partial unique index. Periksa `pg_indexes`.
4. `kf_v15_grading_policies.weights` CHECK hanya membuktikan JSON object, bukan jumlah bobot 100%. Validasi harus dilakukan server-side.
5. Hubungan sertifikat dengan hasil resmi harus diverifikasi pemiliknya (user_id), jenjang/paket, status publikasi, dan kelulusan.
6. Laporan ini belum memverifikasi definisi CHECK, pemetaan paket langganan ke paket asesmen, RPC admin, atau permission/role.

## Query read-only berikut
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
AND tablename IN ('kf_v15_published_results','kf_v15_package_certificates','kf_v15_grading_policies')
ORDER BY tablename, indexname;
```

Jangan merge/deploy sebelum audit selesai dan pengujian regresi lulus.

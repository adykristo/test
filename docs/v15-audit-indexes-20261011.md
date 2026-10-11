# Audit indeks V15 — 11 Oktober 2026

Sumber: CSV pengguna `Supabase Snippet Untitled query (47).csv` berisi 9 indeks `pg_indexes`. Dikonfirmasi melalui isi `indexdef`.

## Ditemukan
- `kf_v15_grading_policies_assessment_key_key`: UNIQUE (`assessment_key`).
- `kf_v15_grading_policies_pkey`: UNIQUE (`id`).
- `kf_v15_one_active_certificate_per_package`: UNIQUE (`user_id`, `jenjang`, `package_no`) WHERE `revoked_at IS NULL`.
- `kf_v15_package_certificates_certificate_number_key`: UNIQUE (`certificate_number`).
- `kf_v15_package_certificates_pkey`: UNIQUE (`id`).
- `kf_v15_package_certificates_verification_token_key`: UNIQUE (`verification_token`).
- `kf_v15_published_results_pkey`: UNIQUE (`id`).
- `kf_v15_result_initial_once`: UNIQUE (`attempt_id`) WHERE `supersedes_id IS NULL`.
- `kf_v15_result_user`: index (`user_id`, `published_at DESC`).

## Keputusan
- Tidak perlu menambah ulang indeks duplikasi nilai awal/sertifikat aktif.
- Indeks bukan bukti konsistensi `published_results.user_id` dengan `kf_attempts.user_id`; validasi server masih wajib.
- Belum ada FK `published_results.attempt_id` dalam audit constraint sebelumnya; perlu penilaian kompatibilitas sebelum penambahan.
- Publikasi revisi (`supersedes_id IS NOT NULL`) tidak dibatasi satu revisi per pendahulu oleh indeks saat ini; gunakan transaksi/RPC aman dan audit.
- Belum membuktikan keamanan RPC, otorisasi admin, keutuhan file backup Storage, dan keberhasilan restore.

## Berikutnya
Audit read-only definisi RPC dan privilege yang relevan sebelum menulis SECURITY DEFINER dan integrasi UI.

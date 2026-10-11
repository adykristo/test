# Audit struktur Supabase V15 — 11 Oktober 2026

Sumber: ekspor information_schema.columns pengguna (73 baris), bukan hasil pemeriksaan nilai/constraint/RPC secara langsung.

| Tabel | Kolom |
|---|---|
| kf_attempts | id uuid, package_id uuid, user_id uuid, attempt_no integer, started_at timestamptz, deadline_at timestamptz, submitted_at timestamptz, status text, objective_score numeric, essay_count integer, auto_submitted boolean |
| kf_answers | id uuid, attempt_id uuid, question_id uuid, answer jsonb, auto_score numeric, needs_review boolean, saved_at timestamptz, needs_manual_review boolean |
| kf_questions | id uuid, package_id uuid, external_id text, position integer, type text, topic text, question text, image text, options jsonb, answer_key jsonb, statements jsonb, category_labels jsonb, explanation text, scoring text, source_v12_package text, source_v12_question text, created_at timestamptz, updated_at timestamptz, ai_provider text, review_status text, reviewed_at timestamptz, published_at timestamptz |
| kf_essay_manual_grades | answer_id uuid, score numeric, max_score numeric, teacher_feedback text, graded_by uuid, graded_at timestamptz |
| kf_v15_grading_policies | id uuid, assessment_key text, weights jsonb, passing_score numeric, version integer, updated_at timestamptz |
| kf_v15_published_results | id uuid, attempt_id uuid, user_id uuid, assessment_key text, policy_version integer, score numeric, score_components jsonb, published_at timestamptz, supersedes_id uuid, published_by uuid |
| kf_v15_package_certificates | id uuid, user_id uuid, jenjang text, package_no integer, published_result_id uuid, certificate_number text, verification_token uuid, issued_at timestamptz, revoked_at timestamptz, replaced_by uuid |

## Keputusan integrasi
- Jangan mengubah kf_attempts.objective_score; hasil lama harus dipertahankan.
- Join esai: kf_answers.id = kf_essay_manual_grades.answer_id.
- Join attempt: kf_answers.attempt_id = kf_attempts.id; join soal: kf_answers.question_id = kf_questions.id.
- Belum terbukti apakah auto_score skala 0–1, poin mentah, atau persentase: **audit sebelum menggabungkan bobot**.
- Jangan percaya kf_attempts.essay_count sebagai satu-satunya indikator esai yang belum dikoreksi.
- Kolom kf_questions.scoring bertipe text: audit format data aktual sebelum parse.
- assessment_key perlu dipetakan ke paket/latihan/tryout yang nyata; jangan mengasumsikan package_id identik dengan paket langganan.
- Sertifikat butuh pemeriksaan kelulusan semua komponen paket, bukan satu attempt saja.
- Status: hanya audit kolom, belum audit foreign key, unique constraint, privilege, RPC, RLS existing, maupun pengujian restore.

## SQL read-only untuk audit lanjutan
```sql
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
WHERE tc.table_schema='public'
AND tc.table_name IN ('kf_attempts','kf_answers','kf_questions','kf_essay_manual_grades',
 'kf_v15_grading_policies','kf_v15_published_results','kf_v15_package_certificates')
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
```

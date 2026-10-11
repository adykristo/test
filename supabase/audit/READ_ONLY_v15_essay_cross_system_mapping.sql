-- KlinikFisikapku: audit lintas sistem esai, HANYA BACA.
-- Jalankan di Supabase SQL Editor lalu Export CSV hasil setiap SELECT.
-- Jangan menyalin skor sebelum pemetaan participant/attempt/question dipastikan.
SELECT table_name,column_name,data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('essay_submissions','assessment_attempts','question_submissions','kf_attempts','kf_answers','kf_essay_manual_grades','kf_questions')
ORDER BY table_name,ordinal_position;

-- Rekap masing-masing sistem tanpa mengubah data.
SELECT 'legacy_essay' AS sumber,count(*) AS total
FROM public.essay_submissions
UNION ALL SELECT 'v15_answers',count(*) FROM public.kf_answers
UNION ALL SELECT 'v15_manual_grades',count(*) FROM public.kf_essay_manual_grades;

-- Hanya jika kolom participant_id, attempt_id, question_id dan grading_status tersedia
-- pada essay_submissions (lihat query struktur di atas).
-- Mencari padanan UUID persis, tidak memakai nama paket/teks jawaban.
SELECT e.id::text AS legacy_essay_id,
       e.participant_id::text AS legacy_participant_id,
       e.attempt_id::text AS legacy_attempt_id,
       e.question_id::text AS legacy_question_id,
       e.grading_status,
       e.score,
       e.max_score,
       a.id::text AS matched_v15_attempt,
       ans.id::text AS matched_v15_answer,
       CASE WHEN a.id IS NULL THEN 'ATTEMPT_TIDAK_COCOK'
            WHEN ans.id IS NULL THEN 'JAWABAN_TIDAK_COCOK'
            ELSE 'ID_COCOK_PERLU_AUDIT' END AS status
FROM public.essay_submissions e
LEFT JOIN public.kf_attempts a
 ON a.id::text=e.attempt_id::text
 AND a.user_id::text=e.participant_id::text
LEFT JOIN public.kf_answers ans
 ON ans.attempt_id=a.id
 AND ans.question_id::text=e.question_id::text
WHERE e.grading_status='graded'
ORDER BY e.graded_at DESC NULLS LAST
LIMIT 100;

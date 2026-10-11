-- LEGACY-ONLY DIAGNOSTIC: JANGAN gunakan untuk status penilaian Question Studio V15 saat ini.
-- Question Studio memuat member/js/kf-essay-grading-v15.js dan memakai kf_essay_manual_grades.
-- Hasil 0 baris di sini normal jika tidak ada esai pada tabel lama essay_submissions.
-- GUNAKAN supabase/audit/READ_ONLY_v15_essay_grades_by_attempt.sql untuk data aktif.
-- KLINIKFISIKAPKU V13 ↔ V15 ESSAY RECONCILIATION (READ ONLY)
-- VERIFIED AGAINST USER CSV: essay_submissions HAS NO attempt_id.
-- Matches only identical participant UUID, package ID string, question ID string,
-- submitted KF attempt, and an existing KF answer for an essay question.
-- Do NOT sync scores merely because the participant/assessment name is similar.
WITH legacy AS (
  SELECT e.id, e.participant_id, e.package_id, e.question_id,
         e.score, e.max_score, e.grading_status, e.graded_at
  FROM public.essay_submissions e
  WHERE e.grading_status = 'graded'
),
legacy_duplicate AS (
  SELECT participant_id, package_id, question_id, count(*) AS legacy_count
  FROM legacy
  GROUP BY participant_id, package_id, question_id
),
candidates AS (
  SELECT e.id AS legacy_id, a.id AS v15_attempt_id,
         ans.id AS v15_answer_id
  FROM legacy e
  JOIN public.kf_attempts a
    ON a.user_id = e.participant_id
   AND a.package_id::text = e.package_id
   AND a.status = 'submitted'
  JOIN public.kf_answers ans
    ON ans.attempt_id = a.id
   AND ans.question_id::text = e.question_id
  JOIN public.kf_questions q
    ON q.id = ans.question_id
   AND q.package_id = a.package_id
   AND lower(q.type) = 'esai'
),
matches AS (
  SELECT legacy_id,
         count(DISTINCT v15_answer_id) AS matched_answers,
         min(v15_answer_id::text) AS only_v15_answer_id,
         min(v15_attempt_id::text) AS only_v15_attempt_id
  FROM candidates
  GROUP BY legacy_id
)
SELECT
  e.id AS legacy_essay_id,
  e.participant_id AS peserta,
  e.package_id AS paket_v13,
  e.question_id AS soal_v13,
  e.score AS nilai_v13,
  e.max_score AS nilai_maksimum_v13,
  coalesce(m.matched_answers,0) AS jumlah_jawaban_v15_cocok,
  CASE WHEN m.matched_answers = 1 THEN m.only_v15_attempt_id END
    AS pengerjaan_v15_cocok,
  CASE WHEN m.matched_answers = 1 THEN m.only_v15_answer_id END
    AS jawaban_v15_cocok,
  CASE
    WHEN e.score IS NULL OR e.max_score IS NULL OR e.max_score <= 0
      OR e.score < 0 OR e.score > e.max_score
      THEN 'NILAI_V13_TIDAK_VALID'
    WHEN dup.legacy_count > 1 THEN 'DATA_ESAI_V13_GANDA'
    WHEN coalesce(m.matched_answers,0) = 0 THEN 'BELUM_ADA_PADANAN_IDENTIK'
    WHEN m.matched_answers > 1 THEN 'PADANAN_V15_LEBIH_DARI_SATU'
    WHEN EXISTS (
      SELECT 1 FROM public.kf_essay_manual_grades g
      WHERE g.answer_id::text = m.only_v15_answer_id
    ) THEN 'SUDAH_ADA_NILAI_V15_JANGAN_TIMPA'
    ELSE 'COCOK_UNIK_BELUM_DISINKRONKAN'
  END AS status_sinkronisasi
FROM legacy e
JOIN legacy_duplicate dup
  ON dup.participant_id = e.participant_id
 AND dup.package_id = e.package_id
 AND dup.question_id = e.question_id
LEFT JOIN matches m ON m.legacy_id = e.id
ORDER BY e.graded_at DESC NULLS LAST, e.id
LIMIT 100;

-- No INSERT/UPDATE/DELETE: the query cannot change participant scores.

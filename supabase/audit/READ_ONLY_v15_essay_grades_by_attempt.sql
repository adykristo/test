-- KlinikFisikapku V15: AUDIT ESAI PER PENGERJAAN (READ ONLY)
-- Sumber: kf_attempts -> kf_answers -> kf_essay_manual_grades.
-- Penilaian pada Question Studio memakai kf_admin_grade_essay_v15 ke tabel ini.
-- HANYA 1 SELECT supaya layar Supabase menampilkan rincian per pengerjaan,
-- bukan hanya rekap total esai dari query terakhir.
-- Tidak menggunakan essay_submissions, karena panel Penilaian Esai memakai V15.
SELECT
  p.jenjang AS jenjang,
  p.name AS nama_asesmen,
  a.id AS id_pengerjaan,
  a.user_id AS id_peserta,
  a.submitted_at,
  COUNT(DISTINCT q.id) AS jumlah_soal_esai,
  COUNT(DISTINCT ans.id) AS jumlah_jawaban_esai_tersimpan,
  COUNT(DISTINCT CASE WHEN g.answer_id IS NOT NULL THEN q.id END) AS jumlah_esai_sudah_dinilai,
  COUNT(DISTINCT q.id)-COUNT(DISTINCT CASE WHEN g.answer_id IS NOT NULL THEN q.id END) AS jumlah_esai_belum_dinilai,
  CASE
    WHEN COUNT(DISTINCT q.id)=0 THEN 'TIDAK_ADA_ESAI'
    WHEN COUNT(DISTINCT CASE WHEN g.answer_id IS NOT NULL THEN q.id END)=COUNT(DISTINCT q.id) THEN 'SIAP_PRATINJAU'
    ELSE 'MENUNGGU_NILAI_ESAI'
  END AS status_esai
FROM public.kf_attempts a
JOIN public.kf_packages p ON p.id=a.package_id
LEFT JOIN public.kf_questions q
  ON q.package_id=a.package_id AND lower(q.type)='esai'
LEFT JOIN public.kf_answers ans
  ON ans.attempt_id=a.id AND ans.question_id=q.id
LEFT JOIN public.kf_essay_manual_grades g
  ON g.answer_id=ans.id
WHERE a.status='submitted'
GROUP BY p.jenjang,p.name,a.id,a.user_id,a.submitted_at
ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC
LIMIT 100;

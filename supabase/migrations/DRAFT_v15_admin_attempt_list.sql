-- KlinikFisikapku V15: admin-only read-only attempt discovery
-- DRAFT, test in staging first. Does not touch legacy RPC, RLS, or scores.
CREATE OR REPLACE FUNCTION public.kf_admin_list_submitted_attempts_v15(
  p_jenjang text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  attempt_id uuid,
  package_id uuid,
  package_name text,
  jenjang text,
  submitted_at timestamptz,
  objective_score numeric,
  question_count bigint,
  graded_essay_count bigint,
  pending_essay_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_admins m
    WHERE m.user_id = auth.uid() AND m.active IS TRUE
      AND m.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE='42501';
  END IF;

  IF p_jenjang IS NOT NULL AND p_jenjang NOT IN ('SD','SMP','SMA') THEN
    RAISE EXCEPTION 'INVALID_JENJANG';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
     OR p_offset IS NULL OR p_offset < 0 OR p_offset > 100000 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION';
  END IF;

  RETURN QUERY
  SELECT a.id, a.package_id, p.name::text, p.jenjang::text,
         a.submitted_at, a.objective_score,
         (SELECT count(*) FROM public.kf_questions q
           WHERE q.package_id = a.package_id),
         (SELECT count(*)
            FROM public.kf_questions q
            JOIN public.kf_answers ans
              ON ans.question_id=q.id AND ans.attempt_id=a.id
            JOIN public.kf_essay_manual_grades g ON g.answer_id=ans.id
           WHERE q.package_id=a.package_id AND lower(q.type)='esai'),
         (SELECT count(*)
            FROM public.kf_questions q
            LEFT JOIN public.kf_answers ans
              ON ans.question_id=q.id AND ans.attempt_id=a.id
            LEFT JOIN public.kf_essay_manual_grades g ON g.answer_id=ans.id
           WHERE q.package_id=a.package_id AND lower(q.type)='esai'
             AND g.answer_id IS NULL)
  FROM public.kf_attempts a
  JOIN public.kf_packages p ON p.id=a.package_id
  WHERE a.status='submitted'
    AND (p_jenjang IS NULL OR p.jenjang=p_jenjang)
  ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_admin_list_submitted_attempts_v15(text,integer,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kf_admin_list_submitted_attempts_v15(text,integer,integer)
  TO authenticated;

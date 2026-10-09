-- KLINIKFISIKAPKU - STAGING ONLY. NEVER run in production without approval.
-- Minimal, guarded migration preserving original function signatures and scoring.
-- Run in a separate Supabase staging project after a verified backup.
BEGIN;
DO $patch$
DECLARE
  f text;
  sig text;
  original text;
  changed text;
  needle text;
  replacement text;
BEGIN
  -- 1. Serialize start attempts per authenticated user and package.
  sig := 'public.kf_start_attempt(uuid)';
  SELECT pg_get_functiondef(to_regprocedure(sig)) INTO original;
  IF original IS NULL THEN RAISE EXCEPTION 'Missing %',sig; END IF;
  needle := '  select count(*) into used';
  replacement := $frag$
  -- Prevent simultaneous Start requests creating multiple attempts.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || p_package::text, 0)
  );

  -- Resume an existing, still-valid attempt instead of consuming a new tryout slot.
  SELECT a.id, a.attempt_no, a.deadline_at
    INTO aid, no, dl
  FROM public.kf_attempts a
  WHERE a.package_id = p.id
    AND a.user_id = auth.uid()
    AND a.status = 'in_progress'
    AND (a.deadline_at IS NULL OR now() <= a.deadline_at)
  ORDER BY a.attempt_no DESC
  LIMIT 1
  FOR UPDATE;

  IF aid IS NOT NULL THEN
    RETURN jsonb_build_object(
      'attempt_id', aid, 'attempt_no', no,
      'deadline_at', dl, 'resumed', true
    );
  END IF;

  select count(*) into used$frag$;
  IF position(needle IN original)=0 OR position('resumed' IN original)>0 THEN
    RAISE EXCEPTION 'Unexpected % definition: stop and review',sig;
  END IF;
  changed := replace(original, needle, replacement);
  EXECUTE changed;

  -- 2. Lock attempt before reading answers and scoring to serialize with save_answer.
  sig := 'public.kf_submit_attempt_v13(uuid,boolean)';
  SELECT pg_get_functiondef(to_regprocedure(sig)) INTO original;
  IF original IS NULL THEN RAISE EXCEPTION 'Missing %',sig; END IF;
  needle := '  where id=p_attempt and user_id=auth.uid();';
  replacement := '  where id=p_attempt and user_id=auth.uid()' || E'\n' || '  FOR UPDATE;';
  IF position(needle IN original)=0 OR position('FOR UPDATE' IN original)>0 THEN
    RAISE EXCEPTION 'Unexpected % definition: stop and review',sig;
  END IF;
  changed := replace(original,needle,replacement);
  EXECUTE changed;
END
$patch$;

-- 3. New separate RPC: avoid changing kf_attempt_questions return signature.
CREATE OR REPLACE FUNCTION public.kf_attempt_saved_answers(p_attempt uuid)
RETURNS TABLE(question_id uuid, answer jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT x.question_id, x.answer
  FROM public.kf_answers x
  JOIN public.kf_attempts a ON a.id=x.attempt_id
  JOIN public.kf_questions q ON q.id=x.question_id AND q.package_id=a.package_id
  WHERE a.id=p_attempt
    AND a.user_id=auth.uid()
    AND a.status='in_progress'
    AND (a.deadline_at IS NULL OR now()<=a.deadline_at)
$fn$;
REVOKE ALL ON FUNCTION public.kf_attempt_saved_answers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kf_attempt_saved_answers(uuid) TO authenticated;
COMMIT;

-- Check returned definitions after migration on staging:
-- SELECT proname,pg_get_functiondef(oid) FROM pg_proc
-- WHERE oid IN ('public.kf_start_attempt(uuid)'::regprocedure,
--               'public.kf_submit_attempt_v13(uuid,boolean)'::regprocedure,
--               'public.kf_attempt_saved_answers(uuid)'::regprocedure);

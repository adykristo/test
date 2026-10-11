-- V15 grading publication: REVIEW ON STAGING BEFORE EXECUTION.
-- Additive RPC; no changes to old kf_attempts.objective_score or kf_answers.
-- Requires existing kf_admin_preview_weighted_score_v15 and v15 tables.
CREATE OR REPLACE FUNCTION public.kf_admin_publish_weighted_result_v15(
  p_attempt uuid,
  p_weights jsonb,
  p_expected_score numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_attempt public.kf_attempts%ROWTYPE;
  v_preview jsonb;
  v_score numeric;
  v_key text;
  v_policy public.kf_v15_grading_policies%ROWTYPE;
  v_previous public.kf_v15_published_results%ROWTYPE;
  v_result_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_admins m
    WHERE m.user_id=auth.uid() AND m.active IS TRUE AND m.role='super_admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE='42501';
  END IF;
  -- Serialize publication and retries for this attempt.
  SELECT * INTO v_attempt FROM public.kf_attempts
  WHERE id=p_attempt AND status='submitted' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBMITTED_ATTEMPT_NOT_FOUND'; END IF;

  v_preview := public.kf_admin_preview_weighted_score_v15(p_attempt,p_weights);
  IF v_preview->>'ready' <> 'true' OR (v_preview->>'pending_count')::integer <> 0 THEN
    RAISE EXCEPTION 'GRADING_NOT_COMPLETE';
  END IF;
  v_score := (v_preview->>'final_score')::numeric;
  IF p_expected_score IS NULL OR p_expected_score <> v_score THEN
    RAISE EXCEPTION 'SCORE_CHANGED_REFRESH_PREVIEW';
  END IF;

  v_key := v_attempt.package_id::text;
  -- Policy versions are snapshotted on each publication. Normalize keys to
  -- ensure semantically equal JSON objects compare equal.
  SELECT * INTO v_policy FROM public.kf_v15_grading_policies
  WHERE assessment_key=v_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.kf_v15_grading_policies
      (assessment_key,weights,passing_score,version)
    VALUES(v_key,p_weights,75,1) RETURNING * INTO v_policy;
  ELSIF v_policy.weights IS DISTINCT FROM p_weights THEN
    UPDATE public.kf_v15_grading_policies
       SET weights=p_weights,version=version+1,updated_at=now()
     WHERE id=v_policy.id RETURNING * INTO v_policy;
  END IF;

  SELECT * INTO v_previous FROM public.kf_v15_published_results
  WHERE attempt_id=p_attempt
  ORDER BY published_at DESC,id DESC LIMIT 1;

  IF FOUND AND v_previous.score=v_score
    AND v_previous.policy_version=v_policy.version
    AND v_previous.score_components=v_preview->'components' THEN
    RETURN jsonb_build_object('result_id',v_previous.id,
      'score',v_previous.score,'policy_version',v_previous.policy_version,
      'already_published',true);
  END IF;

  INSERT INTO public.kf_v15_published_results
    (attempt_id,user_id,assessment_key,policy_version,
     score,score_components,supersedes_id,published_by)
  VALUES(p_attempt,v_attempt.user_id,v_key,v_policy.version,
         v_score,v_preview->'components',v_previous.id,auth.uid())
  RETURNING id INTO v_result_id;

  RETURN jsonb_build_object('result_id',v_result_id,'score',v_score,
    'policy_version',v_policy.version,'already_published',false);
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_admin_publish_weighted_result_v15(uuid,jsonb,numeric)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_admin_publish_weighted_result_v15(uuid,jsonb,numeric)
  TO authenticated;

-- Return the newest score to its owner; old revisions stay as audit snapshots.
CREATE OR REPLACE FUNCTION public.kf_my_latest_published_scores_v15()
RETURNS TABLE(attempt_id uuid,assessment_key text,score numeric,
              policy_version integer,published_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $body$
  SELECT DISTINCT ON (r.attempt_id)
    r.attempt_id,r.assessment_key,r.score,r.policy_version,r.published_at
  FROM public.kf_v15_published_results r
  WHERE r.user_id=(SELECT auth.uid())
  ORDER BY r.attempt_id,r.published_at DESC,r.id DESC;
$body$;
REVOKE ALL ON FUNCTION public.kf_my_latest_published_scores_v15() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_my_latest_published_scores_v15() TO authenticated;

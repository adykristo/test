-- DRAFT: staging only. Creates a separate read-only admin preview RPC.
-- Does not change old scoring, RLS policies, answers or certificates.
CREATE OR REPLACE FUNCTION public.kf_admin_preview_weighted_score_v15(
  p_attempt uuid,
  p_weights jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE
  v_attempt public.kf_attempts%ROWTYPE;
  v_q record;
  v_type text;
  v_weights_sum numeric := 0;
  v_weight numeric;
  v_score numeric;
  v_max numeric;
  v_pending integer := 0;
  v_total integer := 0;
  v_types jsonb := '{}'::jsonb;
  v_components jsonb := '{}'::jsonb;
  v_type_data jsonb;
  v_key text;
  v_result numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_admins m
    WHERE m.user_id=auth.uid() AND m.active IS TRUE AND m.role='super_admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE='42501';
  END IF;

  IF p_weights IS NULL OR jsonb_typeof(p_weights) <> 'object' THEN
    RAISE EXCEPTION 'WEIGHTS_MUST_BE_OBJECT';
  END IF;
  SELECT * INTO v_attempt
  FROM public.kf_attempts
  WHERE id=p_attempt AND status='submitted';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMITTED_ATTEMPT_NOT_FOUND';
  END IF;

  FOR v_q IN
    SELECT q.id, lower(q.type) AS question_type,
           a.id AS answer_id, a.auto_score,
           g.score AS essay_score, g.max_score AS essay_max
      FROM public.kf_questions q
      LEFT JOIN public.kf_answers a
        ON a.question_id=q.id AND a.attempt_id=v_attempt.id
      LEFT JOIN public.kf_essay_manual_grades g ON g.answer_id=a.id
     WHERE q.package_id=v_attempt.package_id
     ORDER BY q.position,q.id
  LOOP
    v_type := v_q.question_type;
    IF v_type NOT IN ('pg4','pg5','mcma','kategori','isian','esai') THEN
      RAISE EXCEPTION 'UNSUPPORTED_QUESTION_TYPE: %',v_type;
    END IF;

    v_total := v_total + 1;
    v_score := NULL;
    v_max := 1;

    IF v_q.answer_id IS NOT NULL THEN
      IF v_type='esai' THEN
        IF v_q.essay_score IS NOT NULL AND v_q.essay_max IS NOT NULL AND v_q.essay_max>0 THEN
          v_score := v_q.essay_score/v_q.essay_max;
        END IF;
      ELSE
        v_score := v_q.auto_score;  -- established V13 scale 0..1
      END IF;
    END IF;

    IF v_score IS NOT NULL AND (v_score<0 OR v_score>1) THEN
      RAISE EXCEPTION 'INVALID_STORED_SCORE for question %',v_q.id;
    END IF;
    IF v_score IS NULL THEN v_pending := v_pending+1; END IF;

    v_type_data := coalesce(v_types->v_type,
      '{"count":0,"graded":0,"sum":0}'::jsonb);
    v_type_data := jsonb_build_object(
      'count',(v_type_data->>'count')::integer+1,
      'graded',(v_type_data->>'graded')::integer+CASE WHEN v_score IS NULL THEN 0 ELSE 1 END,
      'sum',(v_type_data->>'sum')::numeric+coalesce(v_score,0)
    );
    v_types := jsonb_set(v_types,ARRAY[v_type],v_type_data,true);
  END LOOP;

  IF v_total=0 THEN RAISE EXCEPTION 'NO_QUESTIONS'; END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_weights)
  LOOP
    IF v_key NOT IN ('pg4','pg5','mcma','kategori','isian','esai')
      OR jsonb_typeof(p_weights->v_key)<>'number' THEN
      RAISE EXCEPTION 'INVALID_WEIGHT_KEY_OR_VALUE: %',v_key;
    END IF;
    v_weight := (p_weights->>v_key)::numeric;
    IF v_weight<0 OR v_weight>100 THEN
      RAISE EXCEPTION 'WEIGHT_OUT_OF_RANGE: %',v_key;
    END IF;
    IF NOT v_types ? v_key AND v_weight<>0 THEN
      RAISE EXCEPTION 'WEIGHT_FOR_MISSING_TYPE: %',v_key;
    END IF;
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(v_types)
  LOOP
    IF NOT p_weights ? v_key THEN
      RAISE EXCEPTION 'MISSING_WEIGHT_FOR_TYPE: %',v_key;
    END IF;
    v_weight := (p_weights->>v_key)::numeric;
    v_weights_sum := v_weights_sum+v_weight;
    v_type_data := v_types->v_key;
    v_components := jsonb_set(v_components,ARRAY[v_key],
      jsonb_build_object(
        'count',(v_type_data->>'count')::integer,
        'graded',(v_type_data->>'graded')::integer,
        'weight',v_weight,
        'percentage', CASE WHEN (v_type_data->>'graded')::integer=(v_type_data->>'count')::integer
          THEN round(100*(v_type_data->>'sum')::numeric/(v_type_data->>'count')::numeric,2)
          ELSE NULL END
      ),true);
    v_result := v_result+v_weight*(v_type_data->>'sum')::numeric/(v_type_data->>'count')::numeric;
  END LOOP;

  IF abs(v_weights_sum-100)>0.000001 THEN
    RAISE EXCEPTION 'WEIGHTS_MUST_TOTAL_100';
  END IF;

  RETURN jsonb_build_object(
    'attempt_id',v_attempt.id,
    'user_id',v_attempt.user_id,
    'package_id',v_attempt.package_id,
    'question_count',v_total,
    'pending_count',v_pending,
    'ready',v_pending=0,
    'final_score',CASE WHEN v_pending=0 THEN round(v_result,2) ELSE NULL END,
    'components',v_components,
    'status','preview_only'
  );
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_admin_preview_weighted_score_v15(uuid,jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kf_admin_preview_weighted_score_v15(uuid,jsonb)
TO authenticated;

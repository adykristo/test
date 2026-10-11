-- V15 certificate package readiness (READ-ONLY, no issuance)
-- Test on staging. This preview is NOT a certificate eligibility decision.
-- Certificates may require additional completion criteria configured elsewhere.
CREATE OR REPLACE FUNCTION public.kf_admin_preview_package_certification_v15(
  p_user uuid,
  p_member_package uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_pkg public.member_packages%ROWTYPE;
  v_assessment_count integer;
  v_latest_count integer;
  v_legacy_count integer;
  v_new_count integer;
  v_assessments jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.member_admins m
    WHERE m.user_id=auth.uid() AND m.active IS TRUE AND m.role='super_admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE='42501';
  END IF;
  IF p_user IS NULL OR p_member_package IS NULL THEN
    RAISE EXCEPTION 'INVALID_PARAMETERS';
  END IF;
  SELECT * INTO v_pkg FROM public.member_packages WHERE id=p_member_package;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_PACKAGE_NOT_FOUND'; END IF;
  -- The mapping is authoritative. Never infer package from its displayed name.
  WITH linked AS (
     SELECT DISTINCT pa.kf_package_id
     FROM public.kf_package_access pa
     WHERE pa.member_package_id=p_member_package
  ), attempts AS (
     SELECT l.kf_package_id AS assessment_id,
            a.id AS attempt_id,a.submitted_at
     FROM linked l
     LEFT JOIN LATERAL (
       SELECT t.id,t.submitted_at FROM public.kf_attempts t
       WHERE t.package_id=l.kf_package_id AND t.user_id=p_user
         AND t.status='submitted'
       ORDER BY t.submitted_at DESC NULLS LAST,t.attempt_no DESC,t.id DESC
       LIMIT 1
     ) a ON true
  ), results AS (
     SELECT a.assessment_id,a.attempt_id,r.id AS result_id,r.score,r.published_at
     FROM attempts a
     LEFT JOIN LATERAL (
       SELECT id,score,published_at
       FROM public.kf_v15_published_results pr
       WHERE pr.attempt_id=a.attempt_id AND pr.user_id=p_user
       ORDER BY published_at DESC,id DESC LIMIT 1
     ) r ON true
  )
  SELECT count(*),
         count(*) FILTER(WHERE result_id IS NOT NULL),
         coalesce(jsonb_agg(jsonb_build_object(
            'assessment_id',assessment_id,'attempt_id',attempt_id,
            'published',result_id IS NOT NULL,'score',score
         ) ORDER BY assessment_id),'[]'::jsonb)
  INTO v_assessment_count,v_latest_count,v_assessments
  FROM results;

  SELECT count(*) INTO v_legacy_count FROM public.kf_certificates c
  WHERE c.user_id=p_user AND c.member_package_id=p_member_package;
  SELECT count(*) INTO v_new_count FROM public.kf_v15_package_certificates c
  WHERE c.user_id=p_user AND c.jenjang=v_pkg.jenjang
    AND c.package_no=v_pkg.urutan AND c.revoked_at IS NULL;

  RETURN jsonb_build_object(
   'user_id',p_user,'member_package_id',v_pkg.id,
   'jenjang',v_pkg.jenjang,'package_no',v_pkg.urutan,
   'assessment_count',v_assessment_count,
   'published_latest_assessments',v_latest_count,
   'all_latest_published',v_assessment_count>0 AND v_latest_count=v_assessment_count,
   'legacy_certificate_exists',v_legacy_count>0,
   'new_certificate_exists',v_new_count>0,
   'assessments',v_assessments,
   'status','READ_ONLY_PREVIEW_NOT_ELIGIBILITY'
  );
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_admin_preview_package_certification_v15(uuid,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_admin_preview_package_certification_v15(uuid,uuid)
TO authenticated;

-- DRAFT: V15 owner-protected grading operations summary.
-- This RPC is read-only, no changes to existing scores / grants.
CREATE OR REPLACE FUNCTION public.kf_admin_latest_published_results_v15(
  p_jenjang text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
 result_id uuid,
 attempt_id uuid,
 user_id uuid,
 assessment_name text,
 jenjang text,
 score numeric,
 policy_version integer,
 published_at timestamptz,
 revision_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $body$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.member_admins m
  WHERE m.user_id=auth.uid() AND m.active IS TRUE AND m.role='super_admin'
 ) THEN
  RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE='42501';
 END IF;
 IF p_jenjang IS NOT NULL AND p_jenjang NOT IN ('SD','SMP','SMA') THEN
  RAISE EXCEPTION 'INVALID_JENJANG';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100
    OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
  RAISE EXCEPTION 'INVALID_PAGINATION';
 END IF;
 RETURN QUERY
 SELECT latest.id,latest.attempt_id,latest.user_id,
        p.name::text,p.jenjang::text,
        latest.score,latest.policy_version,latest.published_at,
        (SELECT count(*) FROM public.kf_v15_published_results hist
         WHERE hist.attempt_id=latest.attempt_id)
 FROM (
   SELECT DISTINCT ON (r.attempt_id)
       r.id,r.attempt_id,r.user_id,r.score,r.policy_version,r.published_at
   FROM public.kf_v15_published_results r
   ORDER BY r.attempt_id,r.published_at DESC,r.id DESC
 ) latest
 JOIN public.kf_attempts a ON a.id=latest.attempt_id AND a.user_id=latest.user_id
 JOIN public.kf_packages p ON p.id=a.package_id
 WHERE p_jenjang IS NULL OR p.jenjang=p_jenjang
 ORDER BY latest.published_at DESC,latest.id DESC
 LIMIT p_limit OFFSET p_offset;
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_admin_latest_published_results_v15(text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_admin_latest_published_results_v15(text,integer,integer)
TO authenticated;

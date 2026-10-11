-- V15 CERTIFICATE V1 COMPATIBLE CUTOVER — STAGING FIRST.
-- Replaces V1 certificate eligibility and issuer, keeps public.kf_certificates
-- as the SINGLE source of truth. Does not delete/reissue historical records.
-- Test with superadmin, member, and a revoked/expired subscription before live rollout.
BEGIN;

CREATE OR REPLACE FUNCTION public.kf_certificate_status()
RETURNS TABLE(member_package_id uuid, package_name text,
 latihan_total bigint, latihan_lulus bigint,
 tryout_total bigint, tryout_lulus bigint, eligible boolean,
 certificate_id uuid, certificate_number text, issued_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
WITH owned AS (
  SELECT m.id, m.nama
  FROM public.member_packages m
  WHERE m.aktif IS TRUE
    AND auth.uid() IS NOT NULL
    AND public.kf_user_owns_package(m.id)
),
active_assessments AS (
  SELECT DISTINCT o.id AS member_package_id,p.id AS assessment_id,
         lower(coalesce(p.kind,'')) AS kind
  FROM owned o
  JOIN public.kf_package_access pa ON pa.member_package_id=o.id
  JOIN public.kf_packages p ON p.id=pa.kf_package_id
  WHERE p.visible IS TRUE
    AND lower(coalesce(p.kind,'')) IN ('latihan','tryout')
),
per_attempt_latest AS (
  SELECT DISTINCT ON (r.attempt_id)
    r.attempt_id,r.user_id,r.score,r.assessment_key,r.policy_version,
    a.package_id
  FROM public.kf_v15_published_results r
  JOIN public.kf_attempts a ON a.id=r.attempt_id
     AND a.user_id=r.user_id
     AND a.status='submitted'
  WHERE r.user_id=auth.uid()
  ORDER BY r.attempt_id,r.published_at DESC,r.id DESC
),
qualified_assessments AS (
  SELECT aa.member_package_id,aa.assessment_id,aa.kind,
    COALESCE(bool_or(
      pr.attempt_id IS NOT NULL AND pr.score >= COALESCE(gp.passing_score,75)
    ),false) AS passed
  FROM active_assessments aa
  LEFT JOIN per_attempt_latest pr ON pr.package_id=aa.assessment_id
  LEFT JOIN public.kf_v15_grading_policies gp ON gp.assessment_key=aa.assessment_id::text
  GROUP BY aa.member_package_id,aa.assessment_id,aa.kind
),
aggregate_scores AS (
  SELECT o.id,o.nama,
    count(qa.assessment_id) FILTER(WHERE qa.kind='latihan') AS lt,
    count(qa.assessment_id) FILTER(WHERE qa.kind='latihan' AND qa.passed) AS lp,
    count(qa.assessment_id) FILTER(WHERE qa.kind='tryout') AS tt,
    count(qa.assessment_id) FILTER(WHERE qa.kind='tryout' AND qa.passed) AS tp
  FROM owned o
  LEFT JOIN qualified_assessments qa ON qa.member_package_id=o.id
  GROUP BY o.id,o.nama
)
SELECT x.id, x.nama::text, x.lt, x.lp, x.tt, x.tp,
  (x.lt>0 AND x.tt>0 AND x.lt=x.lp AND x.tt=x.tp) AS eligible,
  c.id,c.certificate_number,c.issued_at
FROM aggregate_scores x
LEFT JOIN public.kf_certificates c
  ON c.user_id=auth.uid() AND c.member_package_id=x.id
ORDER BY x.nama;
$body$;

CREATE OR REPLACE FUNCTION public.kf_issue_eligible_certificates()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  r record;
  v_new_id uuid;
  v_count integer := 0;
  v_number text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE='42501';
  END IF;
  -- Serialized for the signed-in user; guards concurrent issuance requests.
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),20261011);
  FOR r IN
    SELECT * FROM public.kf_certificate_status()
    WHERE eligible IS TRUE AND certificate_id IS NULL
  LOOP
    v_number := 'KFP-'||to_char(current_date,'YYYY')||'-'
      ||upper(substr(replace(r.member_package_id::text,'-',''),1,8))||'-'
      ||upper(substr(replace(auth.uid()::text,'-',''),1,8));

    INSERT INTO public.kf_certificates
      (user_id,member_package_id,certificate_number,package_name,qualification_snapshot)
    VALUES(auth.uid(),r.member_package_id,v_number,r.package_name,
      jsonb_build_object(
       'passing_rule','published_weighted_score_at_least_policy_threshold',
       'default_passing_score',75,
       'latihan_total',r.latihan_total,'latihan_lulus',r.latihan_lulus,
       'tryout_total',r.tryout_total,'tryout_lulus',r.tryout_lulus,
       'issued_from','KlinikFisikapku Certificate V15'
      ))
    ON CONFLICT (user_id,member_package_id) DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN v_count:=v_count+1; END IF;
    v_new_id:=NULL;
  END LOOP;
  RETURN v_count;
END;
$body$;

REVOKE ALL ON FUNCTION public.kf_certificate_status() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.kf_issue_eligible_certificates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_certificate_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.kf_issue_eligible_certificates() TO authenticated;
COMMIT;

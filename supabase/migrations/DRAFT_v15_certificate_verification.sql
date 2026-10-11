-- V15 Certificate verification (staging review required).
-- Public response deliberately omits name, email, package and score.
-- This function does not issue certificates or modify existing cert tables.
CREATE OR REPLACE FUNCTION public.kf_verify_certificate_token_v15(p_token uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $body$
  SELECT CASE
    WHEN p_token IS NULL THEN jsonb_build_object('valid', false)
    ELSE coalesce((
      SELECT jsonb_build_object(
        'valid',c.revoked_at IS NULL,
        'status',CASE WHEN c.revoked_at IS NULL THEN 'valid' ELSE 'revoked' END,
        'certificate_number',c.certificate_number,
        'issued_at',c.issued_at
      )
      FROM public.kf_v15_package_certificates c
      WHERE c.verification_token=p_token
      LIMIT 1
    ),jsonb_build_object('valid', false,'status','not_found'))
  END;
$body$;
REVOKE ALL ON FUNCTION public.kf_verify_certificate_token_v15(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kf_verify_certificate_token_v15(uuid) TO anon,authenticated;

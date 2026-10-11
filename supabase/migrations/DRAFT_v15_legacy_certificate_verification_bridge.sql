-- V15 verification bridge — STAGING ONLY until restore + security tests.
-- Preserves all historical kf_certificates, without copying or reissuing them.
BEGIN;
CREATE TABLE IF NOT EXISTS public.kf_v15_certificate_tokens (
 certificate_id uuid PRIMARY KEY REFERENCES public.kf_certificates(id) ON DELETE RESTRICT,
 verification_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kf_v15_certificate_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kf_v15_certificate_tokens FROM PUBLIC,anon,authenticated;

-- Idempotent backfill: makes old and future certificate rows verifiable.
INSERT INTO public.kf_v15_certificate_tokens(certificate_id)
SELECT c.id FROM public.kf_certificates c
ON CONFLICT (certificate_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kf_my_certificate_verification_v15()
RETURNS TABLE (
 certificate_id uuid,
 member_package_id uuid,
 package_name text,
 certificate_number text,
 issued_at timestamptz,
 verification_token uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
 SELECT c.id,c.member_package_id,c.package_name,c.certificate_number,c.issued_at,t.verification_token
 FROM public.kf_certificates c
 LEFT JOIN public.kf_v15_certificate_tokens t ON t.certificate_id=c.id
 WHERE c.user_id=auth.uid()
 ORDER BY c.issued_at DESC,c.id;
$body$;

CREATE OR REPLACE FUNCTION public.kf_verify_certificate_token_v15(p_token uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
 SELECT coalesce((
   SELECT jsonb_build_object('valid',true,'status','valid',
     'certificate_number',c.certificate_number,'issued_at',c.issued_at)
   FROM public.kf_v15_certificate_tokens t
   JOIN public.kf_certificates c ON c.id=t.certificate_id
   WHERE t.verification_token=p_token
   LIMIT 1
 ),jsonb_build_object('valid',false,'status','not_found'));
$body$;
REVOKE ALL ON FUNCTION public.kf_my_certificate_verification_v15() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kf_my_certificate_verification_v15() TO authenticated;
REVOKE ALL ON FUNCTION public.kf_verify_certificate_token_v15(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kf_verify_certificate_token_v15(uuid) TO anon,authenticated;
COMMIT;
-- NOTE: newly issued certificates need token backfill. Run idempotent INSERT above
-- from privileged maintenance workflow after issuer runs, or install the
-- secured trigger below in staging after reviewing certificate INSERT privileges.

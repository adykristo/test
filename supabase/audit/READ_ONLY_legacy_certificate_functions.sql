-- READ ONLY: audit legacy certificate engine before writing any new issuer.
-- Review definitions for embedded credentials/secrets before sharing CSV.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'kf_issue_eligible_certificates',
    'kf_certificate_status',
    'kf_my_certificates'
  )
ORDER BY p.proname;

-- Independent read-only overview: assess duplicate issuance before merging
-- existing and new certificate systems.
SELECT 'legacy' AS source, count(*) AS records FROM public.kf_certificates
UNION ALL
SELECT 'new_v15' AS source,count(*) FROM public.kf_v15_package_certificates;

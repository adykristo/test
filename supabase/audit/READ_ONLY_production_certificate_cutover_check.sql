-- SAFE READ-ONLY DIAGNOSTIC for Supabase PRODUCTION.
-- Run the full query. This does not invoke certificate issuance.
WITH checks AS (
 SELECT 'legacy_certificate_rows' AS check_name,
        (SELECT count(*)::text FROM public.kf_certificates) AS result
 UNION ALL
 SELECT 'verification_token_table_exists',
        (to_regclass('public.kf_v15_certificate_tokens') IS NOT NULL)::text
 UNION ALL
 SELECT 'weighted_results_rows',
        (SELECT count(*)::text FROM public.kf_v15_published_results)
 UNION ALL
 SELECT 'certificate_status_function_exists',
        (to_regprocedure('public.kf_certificate_status()') IS NOT NULL)::text
 UNION ALL
 SELECT 'certificate_issuer_function_exists',
        (to_regprocedure('public.kf_issue_eligible_certificates()') IS NOT NULL)::text
 UNION ALL
 SELECT 'owner_verification_function_exists',
        (to_regprocedure('public.kf_my_certificate_verification_v15()') IS NOT NULL)::text
 UNION ALL
 SELECT 'token_verification_function_exists',
        (to_regprocedure('public.kf_verify_certificate_token_v15(uuid)') IS NOT NULL)::text
 UNION ALL
 SELECT 'old_certificates_untouched_by_new_table',
        (SELECT count(*)::text FROM public.kf_v15_package_certificates)
)
SELECT check_name,result FROM checks ORDER BY check_name;

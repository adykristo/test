-- AUDIT kesiapan onboarding Google KlinikFisikapku (READ ONLY)
-- Hanya metadata, tidak mengubah data, RLS, atau Auth.
WITH expected(name) AS (
 VALUES ('member_profiles'),('member_admins')
), cols AS (
 SELECT table_name,
        string_agg(column_name||' ('||data_type||', nullable='||is_nullable||')',', ' ORDER BY ordinal_position) AS detail
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('member_profiles','member_admins')
 GROUP BY table_name
), functions AS (
 SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
        p.prosecdef AS security_definer,
        has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec,
        has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec
 FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace
 AND (p.proname ILIKE '%register%' OR p.proname ILIKE '%daftar%' OR p.proname ILIKE '%profil%' OR p.proname ILIKE '%onboard%' OR p.proname ILIKE '%admin%')
), triggers AS (
 SELECT tgname AS name, tgrelid::regclass::text AS target,
        tgfoid::regprocedure::text AS function_name
 FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='auth.users'::regclass
)
SELECT 'TABEL' AS bagian,e.name AS objek,coalesce(c.detail,'TIDAK ADA') AS keterangan
FROM expected e LEFT JOIN cols c ON c.table_name=e.name
UNION ALL
SELECT 'RPC',proname||'('||args||')',
       'security_definer='||security_definer||', authenticated_exec='||auth_exec||', anon_exec='||anon_exec'
FROM functions
UNION ALL
SELECT 'TRIGGER AUTH',name,target||' → '||function_name FROM triggers
ORDER BY bagian,objek;

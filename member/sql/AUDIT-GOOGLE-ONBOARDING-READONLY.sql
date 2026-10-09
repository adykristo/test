-- KlinikFisikapku V15: Audit kesiapan Google-only (BACA SAJA)
-- Tidak membuat, mengubah, atau menghapus tabel, akun, RLS, atau fungsi.
WITH expected_tables(table_name) AS (
  VALUES ('member_profiles'), ('member_admins')
),
profile_columns AS (
  SELECT table_name,
         string_agg(
           column_name || ' (' || data_type || ', nullable=' || is_nullable || ')',
           ', ' ORDER BY ordinal_position
         ) AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('member_profiles', 'member_admins')
  GROUP BY table_name
),
candidate_functions AS (
  SELECT p.proname,
         pg_get_function_identity_arguments(p.oid) AS args,
         p.prosecdef AS security_definer,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
  FROM pg_proc AS p
  WHERE p.pronamespace = 'public'::regnamespace
    AND (
      p.proname ILIKE '%register%'
      OR p.proname ILIKE '%daftar%'
      OR p.proname ILIKE '%profil%'
      OR p.proname ILIKE '%onboard%'
      OR p.proname ILIKE '%admin%'
    )
),
auth_triggers AS (
  SELECT t.tgname AS trigger_name,
         t.tgrelid::regclass::text AS target_table,
         t.tgfoid::regprocedure::text AS function_name
  FROM pg_trigger AS t
  WHERE NOT t.tgisinternal
    AND t.tgrelid = 'auth.users'::regclass
)
SELECT 'TABEL'::text AS bagian,
       e.table_name::text AS objek,
       coalesce(c.detail, 'TIDAK ADA')::text AS keterangan
FROM expected_tables AS e
LEFT JOIN profile_columns AS c ON c.table_name = e.table_name
UNION ALL
SELECT 'RPC'::text,
       (f.proname || '(' || f.args || ')')::text,
       ('security_definer=' || f.security_definer::text
         || ', authenticated_exec=' || f.auth_exec::text
         || ', anon_exec=' || f.anon_exec::text)::text
FROM candidate_functions AS f
UNION ALL
SELECT 'TRIGGER AUTH'::text,
       t.trigger_name::text,
       (t.target_table || ' -> ' || t.function_name)::text
FROM auth_triggers AS t
ORDER BY bagian, objek;

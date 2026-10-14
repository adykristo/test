-- KLINIKFISIKAPKU V15 - AUDIT KEAMANAN PRODUCTION (BACA SAJA)
-- Dibuat 2026-10-14. Aman: hanya SELECT dari katalog PostgreSQL dan konfigurasi Storage.
-- Tidak mengubah RLS, policy, grant, data peserta, order, nilai, atau sertifikat.
-- Jalankan sebagai SQL Editor di Supabase V15. Kirim hasilnya (CSV atau screenshot).
-- "CHECK" bukan otomatis rentan; perlu verifikasi fungsi/tujuan bisnis.
WITH
important_tables AS (
  SELECT n.nspname AS schema_name,c.relname AS object_name,c.oid,
         c.relrowsecurity AS rls_on,c.relforcerowsecurity AS force_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (c.relname LIKE 'member\_%' ESCAPE '\'
      OR c.relname LIKE 'kf\_%' ESCAPE '\')
),
table_issues AS (
  SELECT '01_RLS'::text AS area, schema_name||'.'||object_name AS object_name,
    CASE WHEN NOT rls_on THEN 'FAIL' ELSE 'PASS' END AS status,
    CASE WHEN NOT rls_on THEN 'Tabel tanpa RLS. Audit hak akses sebelum pelanggan berbayar.'
         ELSE 'RLS aktif (isi policy tetap perlu diperiksa).' END AS detail
  FROM important_tables
),
policies AS (
  SELECT '02_WRITE_POLICY'::text AS area,
         p.schemaname||'.'||p.tablename||' / '||p.policyname AS object_name,
         CASE WHEN p.cmd IN ('ALL','INSERT','UPDATE','DELETE')
                    AND (p.qual ~* '^\s*\(?\s*true\s*\)?\s*$'
                      OR p.with_check ~* '^\s*\(?\s*true\s*\)?\s*$')
                    AND (p.roles::text ILIKE '%public%'
                      OR p.roles::text ILIKE '%anon%'
                      OR p.roles::text ILIKE '%authenticated%')
              THEN 'CHECK' ELSE 'INFO' END AS status,
         'cmd='||p.cmd||'; roles='||array_to_string(p.roles,',')||
         '; USING='||coalesce(left(p.qual,100),'<null>')||
         '; WITH CHECK='||coalesce(left(p.with_check,100),'<null>') AS detail
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname='public'
    AND (p.tablename LIKE 'member\_%' ESCAPE '\'
      OR p.tablename LIKE 'kf\_%' ESCAPE '\')
),
funcs AS (
  SELECT n.nspname||'.'||p.proname||'('||
         pg_catalog.pg_get_function_identity_arguments(p.oid)||')' AS object_name,
         p.proname, p.oid,p.prosecdef,
         has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
         has_function_privilege('authenticated',p.oid,'EXECUTE') AS user_execute
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND (p.proname LIKE 'kf\_%' ESCAPE '\'
      OR p.proname LIKE 'member\_%' ESCAPE '\'
      OR p.proname LIKE 'admin\_%' ESCAPE '\'
      OR p.proname='is_member_admin')
),
function_permissions AS (
  SELECT '03_RPC_ANON'::text AS area,object_name,
    CASE WHEN anon_execute AND proname ~* '(admin|order|approve|grant|revoke|start_attempt|save_answer|save_essay|submit|grade|publish|issue|upload|delete|update|create|payment)'
         THEN 'FAIL'
         WHEN anon_execute THEN 'CHECK' ELSE 'PASS' END AS status,
    'anon EXECUTE='||anon_execute::text||
    '; authenticated EXECUTE='||user_execute::text||
    '; SECURITY DEFINER='||prosecdef::text||
    CASE WHEN prosecdef THEN '; wajib audit pemeriksaan auth.uid()/role di body fungsi' ELSE '' END AS detail
  FROM funcs
),
storage_buckets AS (
  SELECT '04_STORAGE_BUCKET'::text AS area,
         'storage.buckets/'||id AS object_name,
         CASE WHEN public THEN 'CHECK' ELSE 'PASS' END AS status,
         CASE WHEN public THEN 'Bucket PUBLIC; pastikan tidak menyimpan materi berbayar/jawaban.'
              ELSE 'Bucket PRIVATE; audit policy Storage dan masa berlaku signed URL.' END AS detail
  FROM storage.buckets
),
table_anon AS (
  SELECT '05_TABLE_ANON'::text AS area, schema_name||'.'||object_name AS object_name,
         CASE WHEN NOT rls_on AND (
             has_table_privilege('anon',oid,'SELECT')
             OR has_table_privilege('anon',oid,'INSERT')
             OR has_table_privilege('anon',oid,'UPDATE')
             OR has_table_privilege('anon',oid,'DELETE')) THEN 'FAIL'
              WHEN has_table_privilege('anon',oid,'INSERT')
                OR has_table_privilege('anon',oid,'UPDATE')
                OR has_table_privilege('anon',oid,'DELETE') THEN 'CHECK'
              WHEN has_table_privilege('anon',oid,'SELECT') THEN 'INFO'
              ELSE 'PASS' END AS status,
         'anon SELECT='||has_table_privilege('anon',oid,'SELECT')::text||
         '; INSERT='||has_table_privilege('anon',oid,'INSERT')::text||
         '; UPDATE='||has_table_privilege('anon',oid,'UPDATE')::text||
         '; DELETE='||has_table_privilege('anon',oid,'DELETE')::text AS detail
  FROM important_tables
)
SELECT area,object_name,status,detail
FROM (
  SELECT * FROM table_issues UNION ALL
  SELECT * FROM policies UNION ALL
  SELECT * FROM function_permissions UNION ALL
  SELECT * FROM storage_buckets UNION ALL
  SELECT * FROM table_anon
) audit
ORDER BY CASE status WHEN 'FAIL' THEN 0 WHEN 'CHECK' THEN 1 WHEN 'INFO' THEN 2 ELSE 3 END,
         area,object_name;

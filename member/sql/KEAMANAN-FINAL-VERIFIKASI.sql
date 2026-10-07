-- ============================================================
-- KlinikFisikapku — VERIFIKASI KEAMANAN FINAL (READ ONLY)
-- Tanggal: 2026-10-07
-- HANYA membaca metadata database. Tidak mengubah data/policy/fungsi.
-- Hasil utama: PASS = sesuai target, CHECK = perlu diperiksa.
-- ============================================================

with
important_tables(table_name) as (
  values
    ('member_admins'),
    ('member_packages'),
    ('member_package_topics'),
    ('member_package_subtopics'),
    ('member_content'),
    ('member_content_packages'),
    ('kf_packages'),
    ('kf_package_access'),
    ('kf_questions'),
    ('kf_attempts'),
    ('kf_answers'),
    ('essay_submissions')
),

rls_checks as (
  select
    'RLS'::text as area,
    i.table_name as item,
    case
      when c.oid is null then 'CHECK'
      when c.relrowsecurity then 'PASS'
      else 'CHECK'
    end as result,
    case
      when c.oid is null then 'Tabel tidak ditemukan'
      when c.relrowsecurity then 'RLS aktif'
      else 'RLS tidak aktif'
    end as detail
  from important_tables i
  left join pg_class c
    on c.relname=i.table_name
   and c.relnamespace='public'::regnamespace
   and c.relkind='r'
),

subtopic_write_check as (
  select
    'RLS SUBTOPIK'::text as area,
    'member_package_subtopics write'::text as item,
    case when count(*)=0 then 'PASS' else 'CHECK' end as result,
    case when count(*)=0
      then 'Tidak ada policy INSERT/UPDATE/DELETE authenticated yang terbuka dengan TRUE'
      else 'Ditemukan policy write terlalu longgar: '||
           string_agg(policyname, ', ' order by policyname)
    end as detail
  from pg_policies
  where schemaname='public'
    and tablename='member_package_subtopics'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and (
      coalesce(trim(qual),'') in ('true','(true)')
      or coalesce(trim(with_check),'') in ('true','(true)')
    )
),

admin_helper_check as (
  select
    'ADMIN'::text as area,
    'is_member_admin()'::text as item,
    case
      when p.oid is not null
       and p.prosecdef
       and lower(pg_get_functiondef(p.oid)) like '%auth.uid%'
       and lower(pg_get_functiondef(p.oid)) like '%member_admins%'
       and lower(pg_get_functiondef(p.oid)) like '%active%'
       and lower(pg_get_functiondef(p.oid)) like '%super_admin%'
       and exists (
         select 1
         from unnest(coalesce(p.proconfig,array[]::text[])) x
         where x like 'search_path=%'
       )
      then 'PASS' else 'CHECK'
    end as result,
    case when p.oid is null
      then 'Function is_member_admin() tidak ditemukan'
      else 'security='||
           case when p.prosecdef then 'DEFINER' else 'INVOKER' end||
           ', auth/member_admins/active/super_admin diperiksa='||
           case
             when lower(pg_get_functiondef(p.oid)) like '%auth.uid%'
              and lower(pg_get_functiondef(p.oid)) like '%member_admins%'
              and lower(pg_get_functiondef(p.oid)) like '%active%'
              and lower(pg_get_functiondef(p.oid)) like '%super_admin%'
             then 'YA' else 'TIDAK'
           end
    end as detail
  from (select 1) s
  left join lateral (
    select p.*
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname='is_member_admin'
    limit 1
  ) p on true
),

admin_anon_check as (
  select
    'RPC ADMIN'::text as area,
    'Akses anon ke admin_* / kf_admin_*'::text as item,
    case when count(*)=0 then 'PASS' else 'CHECK' end as result,
    case when count(*)=0
      then 'Tidak ada RPC Admin yang dapat EXECUTE sebagai anon'
      else 'RPC masih dapat dipanggil anon: '||
           string_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', ', ' order by p.proname)
    end as detail
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and (p.proname like 'admin_%' or p.proname like 'kf_admin_%')
    and has_function_privilege('anon',p.oid,'EXECUTE')
),

admin_sensitive_two as (
  select
    'RPC ADMIN'::text as area,
    p.proname as item,
    case
      when not has_function_privilege('anon',p.oid,'EXECUTE')
       and has_function_privilege('authenticated',p.oid,'EXECUTE')
      then 'PASS' else 'CHECK'
    end as result,
    'anon='||has_function_privilege('anon',p.oid,'EXECUTE')::text||
    ', authenticated='||has_function_privilege('authenticated',p.oid,'EXECUTE')::text as detail
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname in ('kf_admin_approve_order','kf_admin_log')
),

start_attempt_check as (
  select
    'PAKET / ATTEMPT'::text as area,
    'kf_start_attempt'::text as item,
    case
      when p.oid is not null
       and lower(pg_get_functiondef(p.oid)) like '%auth.uid%'
       and lower(pg_get_functiondef(p.oid)) like '%kf_user_owns_package%'
       and lower(pg_get_functiondef(p.oid)) like '%kf_package_access%'
      then 'PASS' else 'CHECK'
    end as result,
    case when p.oid is null
      then 'Function tidak ditemukan'
      else 'Cek auth.uid + ownership paket + package_access'
    end as detail
  from (select 1) s
  left join lateral (
    select p.*
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname='kf_start_attempt'
    limit 1
  ) p on true
),

attempt_functions as (
  select
    'PAKET / ATTEMPT'::text as area,
    p.proname as item,
    case
      when lower(pg_get_functiondef(p.oid)) like '%auth.uid%'
       and lower(pg_get_functiondef(p.oid)) like '%kf_attempts%'
       and (
         lower(pg_get_functiondef(p.oid)) like '%user_id%'
         or lower(pg_get_functiondef(p.oid)) like '%member_id%'
       )
      then 'PASS' else 'CHECK'
    end as result,
    'Verifikasi user login + attempt + pemilik attempt'::text as detail
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.proname in (
      'kf_attempt_questions',
      'kf_save_answer',
      'kf_save_essay_submission',
      'kf_submit_attempt_v13',
      'kf_review_attempt'
    )
),

bucket_checks as (
  select
    'STORAGE'::text as area,
    v.bucket_id as item,
    case
      when b.id is null then 'CHECK'
      when b.public=v.expected_public then 'PASS'
      else 'CHECK'
    end as result,
    case when b.id is null
      then 'Bucket tidak ditemukan'
      else 'public='||b.public::text||', expected='||v.expected_public::text
    end as detail
  from (values
    ('essay-submissions',false),
    ('learning-files',true),
    ('learning-files-private',false)
  ) v(bucket_id,expected_public)
  left join storage.buckets b on b.id=v.bucket_id
),

storage_broad_write as (
  select
    'STORAGE'::text as area,
    'Policy write terlalu terbuka'::text as item,
    case when count(*)=0 then 'PASS' else 'CHECK' end as result,
    case when count(*)=0
      then 'Tidak ada policy INSERT/UPDATE/DELETE Storage yang memakai TRUE tanpa pembatasan'
      else 'Periksa: '||string_agg(policyname, ', ' order by policyname)
    end as detail
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and (
      coalesce(trim(qual),'') in ('true','(true)')
      or coalesce(trim(with_check),'') in ('true','(true)')
    )
),

learning_private_read as (
  select
    'STORAGE'::text as area,
    'learning-files-private SELECT'::text as item,
    case when count(*)>0 then 'PASS' else 'CHECK' end as result,
    case when count(*)>0
      then 'Ada policy baca private dengan pemeriksaan Admin / ownership paket'
      else 'Policy baca learning-files-private yang aman tidak ditemukan'
    end as detail
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and cmd='SELECT'
    and (
      lower(coalesce(qual,'')) like '%learning-files-private%'
      and (
        lower(coalesce(qual,'')) like '%kf_is_admin%'
        or lower(coalesce(qual,'')) like '%member_package_ownerships%'
      )
    )
),

essay_owner_check as (
  select
    'STORAGE'::text as area,
    'essay-submissions owner isolation'::text as item,
    case when count(*)>=1 then 'PASS' else 'CHECK' end as result,
    case when count(*)>=1
      then 'Policy essay mengikat folder file ke auth.uid()'
      else 'Tidak menemukan policy essay yang mengikat folder ke auth.uid()'
    end as detail
  from pg_policies
  where schemaname='storage'
    and tablename='objects'
    and (
      lower(coalesce(qual,'')) like '%essay-submissions%'
      or lower(coalesce(with_check,'')) like '%essay-submissions%'
    )
    and (
      lower(coalesce(qual,'')) like '%auth.uid%'
      or lower(coalesce(with_check,'')) like '%auth.uid%'
    )
    and (
      lower(coalesce(qual,'')) like '%foldername%'
      or lower(coalesce(with_check,'')) like '%foldername%'
    )
),

security_definer_search_path as (
  select
    'RPC'::text as area,
    'SECURITY DEFINER search_path'::text as item,
    case when count(*)=0 then 'PASS' else 'CHECK' end as result,
    case when count(*)=0
      then 'Semua RPC aplikasi SECURITY DEFINER memiliki search_path eksplisit'
      else 'Tanpa search_path: '||
           string_agg(p.proname, ', ' order by p.proname)
    end as detail
  from pg_proc p
  where p.pronamespace='public'::regnamespace
    and p.prosecdef=true
    and (
      p.proname like 'kf_%'
      or p.proname like 'admin_%'
      or p.proname='is_member_admin'
    )
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig,array[]::text[])) x
      where x like 'search_path=%'
    )
)

select * from rls_checks
union all select * from subtopic_write_check
union all select * from admin_helper_check
union all select * from admin_anon_check
union all select * from admin_sensitive_two
union all select * from start_attempt_check
union all select * from attempt_functions
union all select * from bucket_checks
union all select * from storage_broad_write
union all select * from learning_private_read
union all select * from essay_owner_check
union all select * from security_definer_search_path
order by
  case result when 'CHECK' then 0 else 1 end,
  area,
  item;

-- ============================================================
-- INTERPRETASI
-- 1) Ideal: seluruh baris PASS.
-- 2) Jika ada CHECK, jangan langsung mengubah database.
--    Kirim screenshot/baris CHECK untuk diperiksa dulu.
-- 3) learning-files memang masih public=true karena dipakai legacy.
--    Jangan ubah menjadi private tanpa migrasi URL/file.
-- ============================================================

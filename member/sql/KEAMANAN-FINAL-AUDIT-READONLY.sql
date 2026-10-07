-- KlinikFisikapku — AUDIT KEAMANAN FINAL (READ ONLY)
-- Aman dijalankan di Supabase SQL Editor. Script ini TIDAK mengubah data, policy, fungsi, atau tabel.

-- 1. Status RLS tabel penting
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind='r'
  and (
    c.relname like 'member_%'
    or c.relname like 'kf_%'
  )
order by c.relname;

-- 2. Semua policy tabel aplikasi
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and (tablename like 'member_%' or tablename like 'kf_%')
order by tablename, policyname;

-- 3. DETEKSI policy berisiko: authenticated/anon diberi ALL/INSERT/UPDATE/DELETE dengan TRUE
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and (
    roles::text ilike '%authenticated%'
    or roles::text ilike '%anon%'
    or roles::text ilike '%public%'
  )
  and cmd in ('ALL','INSERT','UPDATE','DELETE')
  and (
    coalesce(trim(qual),'') in ('true','(true)')
    or coalesce(trim(with_check),'') in ('true','(true)')
  )
order by tablename, policyname;

-- 4. Grant tabel untuk anon/authenticated
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated')
  and (table_name like 'member_%' or table_name like 'kf_%')
order by table_name, grantee, privilege_type;

-- 5. RPC/function aplikasi + SECURITY DEFINER + konfigurasi search_path
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
       p.proconfig as function_config,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and (p.proname like 'kf_%' or p.proname like 'admin_%')
order by p.proname;

-- 6. SECURITY DEFINER tanpa search_path eksplisit (perlu ditinjau)
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef=true
  and (p.proname like 'kf_%' or p.proname like 'admin_%')
  and not exists (
    select 1 from unnest(coalesce(p.proconfig,array[]::text[])) x
    where x like 'search_path=%'
  )
order by p.proname;

-- 7. Storage bucket: bucket public berarti file dapat dibaca tanpa signed URL
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

-- 8. Policy storage.objects
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='storage' and tablename='objects'
order by policyname;

-- 9. Admin aktif (tidak menampilkan token/password)
select role, active, count(*) as jumlah
from public.member_admins
group by role, active
order by role, active;

-- CATATAN:
-- Hasil audit ini tidak mengubah apa pun. Simpan/copy seluruh result dari tiap query.
-- Perbaikan dilakukan terpisah setelah hasil aktual database diperiksa.

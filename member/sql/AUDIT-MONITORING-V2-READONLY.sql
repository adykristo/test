-- ======================================================================
-- KlinikFisikapku / Monitoring Peserta V2
-- AUDIT-MONITORING-V2-READONLY.sql
-- Aman dijalankan di proyek PRODUKSI karena HANYA SELECT metadata + agregat.
-- TANPA INSERT / UPDATE / DELETE / ALTER / GRANT / REVOKE / CREATE.
-- Tidak menampilkan nama, email, UUID peserta, password, atau rincian pembayaran.
-- Penting: periksa PROJECT Supabase yang sedang terbuka sebelum menekan RUN.
-- ======================================================================

with
wanted_tables(table_name) as (
 values
 ('member_admins'), ('member_packages'), ('member_package_ownerships'),
 ('member_bundle_orders'), ('member_bundle_order_items'),
 ('member_content'), ('member_content_packages'), ('kf_package_access')
),
table_status as (
 select
   'TABEL / RLS'::text as area, w.table_name::text as item,
   case when c.oid is null then 'CHECK: MISSING'
        when c.relrowsecurity then 'PASS'
        else 'CHECK: RLS OFF' end::text as result,
   case when c.oid is null then 'Tabel tidak ditemukan'
        else 'RLS='||c.relrowsecurity::text
          ||', SELECT anon='||has_table_privilege('anon',c.oid,'SELECT')::text
          ||', SELECT authenticated='||has_table_privilege('authenticated',c.oid,'SELECT')::text
   end::text as detail
 from wanted_tables w
 left join pg_class c on c.relname=w.table_name
  and c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
),
wanted_functions(name) as (
 values ('kf_is_admin'),('is_member_admin'),
        ('kf_admin_member_packages'),('kf_admin_bundle_orders'),
        ('kf_admin_bundle_order_items'),('kf_admin_approve_bundle_order'),
        ('kf_admin_grant_member_package'),('kf_admin_revoke_member_package')
),
function_status as (
 select 'RPC ADMIN'::text as area,
   (w.name||'('||coalesce(pg_get_function_identity_arguments(p.oid),'?')||')')::text as item,
   case when p.oid is null then 'CHECK: MISSING'
        when has_function_privilege('anon',p.oid,'EXECUTE') then 'CHECK: ANON EXECUTE'
        when not has_function_privilege('authenticated',p.oid,'EXECUTE') then 'CHECK: AUTH BLOCK'
        when not p.prosecdef then 'CHECK: REVIEW SECURITY'
        when not exists (
             select 1 from unnest(coalesce(p.proconfig,array[]::text[])) pc
             where pc like 'search_path=%'
          ) then 'CHECK: SEARCH_PATH'
        else 'PASS' end::text as result,
   case when p.oid is null then 'Fungsi tidak ditemukan'
        else 'SECURITY DEFINER='||p.prosecdef::text
         ||', anon EXECUTE='||has_function_privilege('anon',p.oid,'EXECUTE')::text
         ||', auth EXECUTE='||has_function_privilege('authenticated',p.oid,'EXECUTE')::text
         ||', search_path diatur='||exists(
               select 1 from unnest(coalesce(p.proconfig,array[]::text[])) pc
               where pc like 'search_path=%')::text
   end::text as detail
 from wanted_functions w
 left join pg_proc p on p.proname=w.name
   and p.pronamespace='public'::regnamespace
),
policy_summary as (
 select 'POLICY SELECT'::text as area,p.tablename::text as item,
  'REVIEW'::text as result,
  string_agg(p.policyname||' [roles='||array_to_string(p.roles,',')||'; cmd='||p.cmd||']',
             '; ' order by p.policyname)::text as detail
 from pg_policies p
 where p.schemaname='public' and p.tablename in
 ('member_admins','member_packages','member_package_ownerships',
  'member_bundle_orders','member_bundle_order_items',
  'member_content','member_content_packages')
  and p.cmd in('SELECT','ALL')
 group by p.tablename
),
order_columns as (
 select 'KOLOM TRANSAKSI'::text as area, table_name::text as item,
  'INFO'::text as result,
  string_agg(column_name||':'||data_type, ', ' order by ordinal_position)::text as detail
 from information_schema.columns
 where table_schema='public' and table_name in
   ('member_bundle_orders','member_bundle_order_items','member_package_ownerships')
 group by table_name
),
order_statuses as (
 select 'STATUS DATA (AGREGAT)'::text as area,
   'member_bundle_orders'::text as item,'INFO'::text as result,
   coalesce(jsonb_object_agg(status_name,total),'{}'::jsonb)::text as detail
 from (
   select coalesce(status::text,'(null)') status_name,count(*) total
   from public.member_bundle_orders
   group by 1
 ) stats
),
ownership_statuses as (
 select 'STATUS DATA (AGREGAT)'::text as area,
   'member_package_ownerships'::text as item,'INFO'::text as result,
   coalesce(jsonb_object_agg(status_name,total),'{}'::jsonb)::text as detail
 from (
   select coalesce(status::text,'(null)') status_name,count(*) total
   from public.member_package_ownerships
   group by 1
 ) stats
)
select area,item,result,detail
from (
 select * from table_status
 union all select * from function_status
 union all select * from policy_summary
 union all select * from order_columns
 union all select * from order_statuses
 union all select * from ownership_statuses
) audit
order by case when result like 'CHECK%' then 0 else 1 end,area,item;

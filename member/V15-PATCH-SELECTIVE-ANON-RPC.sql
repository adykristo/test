-- KlinikFisikapku V15 — SELECTIVE ANON RPC HARDENING V2
-- Tidak menebak signature fungsi. Semua overload ditemukan dari pg_proc.
-- Aman untuk registrasi: kf_username_available TIDAK ditutup.
begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname in (
        'admin_list_members_masked','admin_update_member','admin_set_member_tahap',
        'kf_member_package_catalog','kf_member_topics',
        'kf_create_package_order','kf_bundle_quote','kf_create_bundle_order',
        'kf_member_content_v2','touch_member_content',
        'kf_admin_member_packages','kf_admin_revoke_member_package',
        'kf_admin_grant_member_package','kf_admin_bundle_orders',
        'kf_admin_bundle_order_items','kf_admin_approve_bundle_order',
        'kf_admin_cancel_bundle_order','kf_admin_archive_bundle_order',
        'kf_list_available_packages','kf_start_attempt','kf_attempt_questions',
        'kf_save_answer','kf_save_essay_submission','kf_submit_attempt_v13',
        'kf_review_attempt','kf_my_results'
      )
  loop
    execute format('revoke execute on function %s from public',r.sig);
    execute format('revoke execute on function %s from anon',r.sig);
    execute format('grant execute on function %s to authenticated',r.sig);
  end loop;
end $$;

commit;

-- VERIFIKASI per signature aktual.
with wanted(name) as (values
 ('admin_list_members_masked'),('admin_update_member'),('admin_set_member_tahap'),
 ('kf_member_package_catalog'),('kf_member_topics'),('kf_create_package_order'),
 ('kf_bundle_quote'),('kf_create_bundle_order'),('kf_member_content_v2'),
 ('touch_member_content'),('kf_admin_member_packages'),('kf_admin_revoke_member_package'),
 ('kf_admin_grant_member_package'),('kf_admin_bundle_orders'),('kf_admin_bundle_order_items'),
 ('kf_admin_approve_bundle_order'),('kf_admin_cancel_bundle_order'),('kf_admin_archive_bundle_order'),
 ('kf_list_available_packages'),('kf_start_attempt'),('kf_attempt_questions'),
 ('kf_save_answer'),('kf_save_essay_submission'),('kf_submit_attempt_v13'),
 ('kf_review_attempt'),('kf_my_results')
),
actual as (
 select w.name,p.oid,p.oid::regprocedure::text signature
 from wanted w
 left join pg_proc p on p.proname=w.name and p.pronamespace='public'::regnamespace
)
select name,coalesce(signature,'—') signature,
 case when oid is null then 'FAIL: MISSING'
      when has_function_privilege('anon',oid,'EXECUTE') then 'FAIL: ANON'
      when not has_function_privilege('authenticated',oid,'EXECUTE') then 'FAIL: AUTH'
      else 'PASS' end result
from actual
order by case
 when oid is null then 0
 when has_function_privilege('anon',oid,'EXECUTE') then 0
 when not has_function_privilege('authenticated',oid,'EXECUTE') then 0
 else 1 end,name,signature;

select 'kf_username_available' name,
 case when exists(
   select 1 from pg_proc p
   where p.pronamespace='public'::regnamespace and p.proname='kf_username_available'
 ) then 'EXPECTED: REGISTRATION RPC' else 'FAIL: MISSING' end result;

-- KlinikFisikapku V15 — SELECTIVE ANON RPC HARDENING
-- Aman untuk registrasi: kf_username_available TIDAK ditutup.
-- Tidak mengubah isi fungsi atau data.

begin;

-- ADMIN: wajib login dan pemeriksaan role di server.
revoke execute on function public.admin_list_members_masked() from public, anon;
revoke execute on function public.admin_update_member(uuid,text,jsonb) from public, anon;
revoke execute on function public.admin_set_member_tahap(uuid,integer) from public, anon;

-- V15 package/attempt engine: hanya peserta authenticated.
-- revoke berbasis nama/signature yang sudah diketahui dari instalasi V15.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname in (
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

-- VERIFIKASI: hanya fungsi yang memang harus private.
with private_rpc(name) as (values
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
x as (
 select r.name,p.oid,
   case when p.oid is null then null else has_function_privilege('anon',p.oid,'EXECUTE') end anon_exec,
   case when p.oid is null then null else has_function_privilege('authenticated',p.oid,'EXECUTE') end auth_exec
 from private_rpc r
 left join pg_proc p on p.proname=r.name and p.pronamespace='public'::regnamespace
)
select name,
 case when oid is null then 'FAIL: MISSING'
      when anon_exec then 'FAIL: ANON'
      when not auth_exec then 'FAIL: AUTH'
      else 'PASS' end result
from x
order by case when oid is null or anon_exec or not auth_exec then 0 else 1 end,name;

-- Fungsi pra-login: username availability memang dibutuhkan halaman registrasi.
select 'kf_username_available' name,
 case when exists(
   select 1 from pg_proc p
   where p.pronamespace='public'::regnamespace and p.proname='kf_username_available'
 ) then 'EXPECTED: REGISTRATION RPC' else 'FAIL: MISSING' end result;

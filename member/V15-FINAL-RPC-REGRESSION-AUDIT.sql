-- KlinikFisikapku V15 — FINAL RPC REGRESSION AUDIT (READ ONLY)
-- Tidak mengubah data/fungsi. Jalankan di Supabase SQL Editor setelah patch keamanan.
with required(name, anon_should_execute, auth_should_execute) as (
 values
 ('kf_username_available',false,true),
 ('kf_member_package_catalog',false,true),
 ('kf_member_topics',false,true),
 ('kf_payment_methods',false,true),
 ('kf_create_package_order',false,true),
 ('kf_bundle_quote',false,true),
 ('kf_create_bundle_order',false,true),
 ('kf_member_content_v2',false,true),
 ('touch_member_content',false,true),
 ('admin_list_members_masked',false,true),
 ('admin_update_member',false,true),
 ('admin_set_member_tahap',false,true),
 ('kf_admin_member_packages',false,true),
 ('kf_admin_revoke_member_package',false,true),
 ('kf_admin_grant_member_package',false,true),
 ('kf_admin_bundle_orders',false,true),
 ('kf_admin_bundle_order_items',false,true),
 ('kf_admin_approve_bundle_order',false,true),
 ('kf_admin_cancel_bundle_order',false,true),
 ('kf_admin_archive_bundle_order',false,true),
 ('kf_list_available_packages',false,true),
 ('kf_start_attempt',false,true),
 ('kf_attempt_questions',false,true),
 ('kf_save_answer',false,true),
 ('kf_save_essay_submission',false,true),
 ('kf_submit_attempt_v13',false,true),
 ('kf_review_attempt',false,true),
 ('kf_my_results',false,true)
),
f as (
 select r.*,p.oid,p.prosecdef,p.proconfig,
        has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') auth_execute
 from required r
 left join pg_proc p on p.proname=r.name
 left join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
)
select name,
       case when oid is null then 'FAIL: MISSING'
            when anon_execute<>anon_should_execute then 'FAIL: ANON PRIVILEGE'
            when auth_execute<>auth_should_execute then 'FAIL: AUTH PRIVILEGE'
            else 'PASS' end as result,
       coalesce(prosecdef,false) as security_definer,
       anon_execute,auth_execute,
       array_to_string(proconfig,', ') as function_settings
from f
order by case when oid is null or anon_execute<>anon_should_execute or auth_execute<>auth_should_execute then 0 else 1 end,name;

-- Ringkasan
with required(name) as (values
 ('kf_username_available'),('kf_member_package_catalog'),('kf_member_topics'),('kf_payment_methods'),
 ('kf_create_package_order'),('kf_bundle_quote'),('kf_create_bundle_order'),('kf_member_content_v2'),
 ('touch_member_content'),('admin_list_members_masked'),('admin_update_member'),('admin_set_member_tahap'),
 ('kf_admin_member_packages'),('kf_admin_revoke_member_package'),('kf_admin_grant_member_package'),
 ('kf_admin_bundle_orders'),('kf_admin_bundle_order_items'),('kf_admin_approve_bundle_order'),
 ('kf_admin_cancel_bundle_order'),('kf_admin_archive_bundle_order'),('kf_list_available_packages'),
 ('kf_start_attempt'),('kf_attempt_questions'),('kf_save_answer'),('kf_save_essay_submission'),
 ('kf_submit_attempt_v13'),('kf_review_attempt'),('kf_my_results')
)
select count(*) total_required,
       count(p.oid) found,
       count(*)-count(p.oid) missing
from required r
left join pg_proc p on p.proname=r.name
left join pg_namespace n on n.oid=p.pronamespace and n.nspname='public';

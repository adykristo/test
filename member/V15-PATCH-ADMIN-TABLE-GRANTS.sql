-- KlinikFisikapku V15 — FIX ADMIN TABLE PRIVILEGES
-- Memperbaiki "permission denied for table ..." setelah RLS hardening.
-- Aman: privilege authenticated tetap dibatasi RLS kf_is_admin().
begin;

do $$
declare t text;
begin
  foreach t in array array[
    'member_packages',
    'member_package_topics',
    'member_content',
    'member_content_packages',
    'member_payment_methods',
    'member_discount_rules',
    'member_admin_logs',
    'kf_packages',
    'kf_package_access',
    'kf_questions'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on table public.%I from anon',t);
      execute format('grant select, insert, update, delete on table public.%I to authenticated',t);
    end if;
  end loop;
end $$;

commit;

-- VERIFIKASI: authenticated punya privilege tabel, anon tetap tidak.
select
  t.table_name,
  has_table_privilege('authenticated','public.'||t.table_name,'SELECT') as authenticated_select,
  has_table_privilege('authenticated','public.'||t.table_name,'INSERT') as authenticated_insert,
  has_table_privilege('authenticated','public.'||t.table_name,'UPDATE') as authenticated_update,
  has_table_privilege('authenticated','public.'||t.table_name,'DELETE') as authenticated_delete,
  has_table_privilege('anon','public.'||t.table_name,'SELECT') as anon_select
from (values
 ('member_packages'),('member_package_topics'),('member_content'),
 ('member_content_packages'),('member_payment_methods'),('member_discount_rules'),
 ('member_admin_logs'),('kf_packages'),('kf_package_access'),('kf_questions')
) as t(table_name)
where to_regclass('public.'||t.table_name) is not null
order by t.table_name;

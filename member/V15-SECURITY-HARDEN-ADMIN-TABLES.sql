-- KlinikFisikapku V15 — ADMIN TABLE RLS HARDENING
-- Jalankan SETELAH V15-SECURITY-REVIEW-AND-RLS-V13.sql.
-- Tidak menghapus data. Tujuan: CRUD dari browser Admin hanya berhasil
-- untuk akun authenticated yang tercatat sebagai super_admin aktif.
begin;

create or replace function public.kf_is_admin()
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1 from public.member_admins
    where user_id=auth.uid() and active=true and role='super_admin'
  );
$$;
revoke all on function public.kf_is_admin() from public;
grant execute on function public.kf_is_admin() to authenticated;

-- Tabel konfigurasi/admin yang digunakan langsung oleh halaman Admin.
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
    'kf_package_access'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('drop policy if exists %I on public.%I','kf_admin_all_'||t,t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.kf_is_admin()) with check (public.kf_is_admin())',
        'kf_admin_all_'||t,t
      );
      execute format('revoke all on table public.%I from anon',t);
    end if;
  end loop;
end $$;

-- Engine soal: pertahankan aturan bahwa kunci soal hanya dapat dibaca Admin.
alter table if exists public.kf_questions enable row level security;
drop policy if exists kf_questions_admin_all on public.kf_questions;
create policy kf_questions_admin_all
on public.kf_questions for all to authenticated
using(public.kf_is_admin())
with check(public.kf_is_admin());
revoke all on table public.kf_questions from anon;

-- Admin identity table: user authenticated hanya boleh membaca baris admin miliknya
-- untuk proses guard. Perubahan daftar Admin tidak diberikan melalui browser biasa.
alter table if exists public.member_admins enable row level security;
drop policy if exists kf_admin_self_read on public.member_admins;
create policy kf_admin_self_read
on public.member_admins for select to authenticated
using(user_id=auth.uid());
revoke all on table public.member_admins from anon;

commit;

-- VERIFIKASI
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace='public'::regnamespace
and relname in (
 'member_admins','member_packages','member_package_topics','member_content',
 'member_content_packages','member_payment_methods','member_discount_rules',
 'member_admin_logs','kf_packages','kf_package_access','kf_questions'
)
order by relname;

select tablename,policyname,cmd,roles
from pg_policies
where schemaname='public'
and tablename in (
 'member_admins','member_packages','member_package_topics','member_content',
 'member_content_packages','member_payment_methods','member_discount_rules',
 'member_admin_logs','kf_packages','kf_package_access','kf_questions'
)
order by tablename,policyname;

-- ================================================================
-- KLINIKFISIKAPKU V15 — MASTER SECURITY FINAL
-- 2026-10-04
-- Aman untuk data: tidak TRUNCATE/DROP TABLE, tidak menghapus peserta,
-- tidak mengubah bucket legacy learning-files.
-- ================================================================

-- 1) ADMIN / PUBLISHER RLS
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

do $$
declare t text;
begin
  foreach t in array array[
    'member_packages','member_package_topics','member_content',
    'member_content_packages','member_payment_methods','member_discount_rules',
    'member_admin_logs','kf_packages','kf_package_access'
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

alter table if exists public.kf_questions enable row level security;
drop policy if exists kf_questions_admin_all on public.kf_questions;
create policy kf_questions_admin_all on public.kf_questions
for all to authenticated using(public.kf_is_admin()) with check(public.kf_is_admin());
revoke all on table public.kf_questions from anon;

alter table if exists public.member_admins enable row level security;
drop policy if exists kf_admin_self_read on public.member_admins;
create policy kf_admin_self_read on public.member_admins
for select to authenticated using(user_id=auth.uid());
revoke all on table public.member_admins from anon;

commit;

-- 2) PRIVATE PDF BARU
-- Bucket legacy "learning-files" TIDAK disentuh.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learning-files-private','learning-files-private',false,104857600,array['application/pdf'])
on conflict(id) do update set
 public=false,file_size_limit=104857600,allowed_mime_types=array['application/pdf'];

drop policy if exists "KF admin upload private learning files" on storage.objects;
drop policy if exists "KF admin update private learning files" on storage.objects;
drop policy if exists "KF admin delete private learning files" on storage.objects;
drop policy if exists "KF member read owned private learning files" on storage.objects;

create policy "KF admin upload private learning files"
on storage.objects for insert to authenticated
with check(bucket_id='learning-files-private' and public.kf_is_admin());

create policy "KF admin update private learning files"
on storage.objects for update to authenticated
using(bucket_id='learning-files-private' and public.kf_is_admin())
with check(bucket_id='learning-files-private' and public.kf_is_admin());

create policy "KF admin delete private learning files"
on storage.objects for delete to authenticated
using(bucket_id='learning-files-private' and public.kf_is_admin());

create policy "KF member read owned private learning files"
on storage.objects for select to authenticated
using(
 bucket_id='learning-files-private'
 and (
   public.kf_is_admin()
   or exists(
     select 1 from public.member_package_ownerships o
     where o.user_id=auth.uid()
       and o.status='active'
       and (o.expires_at is null or o.expires_at>now())
       and o.package_id::text=(storage.foldername(name))[1]
   )
 )
);
commit;

-- 3) ESSAY FILE FINAL HARDENING
begin;

create or replace function public.kf_save_essay_submission(
 p_attempt uuid,p_question uuid,p_answer_text text default '',p_answer_file_url text default ''
)
returns jsonb
language plpgsql security definer
set search_path=public,storage
as $$
declare
 v_uid uuid:=auth.uid(); v_package uuid; v_status text;
 v_deadline timestamptz; v_path text:=nullif(trim(coalesce(p_answer_file_url,'')),'');
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select a.package_id,a.status,a.deadline_at into v_package,v_status,v_deadline
 from public.kf_attempts a where a.id=p_attempt and a.user_id=v_uid;
 if v_package is null then raise exception 'ATTEMPT_NOT_FOUND'; end if;
 if v_status<>'in_progress' then raise exception 'ATTEMPT_NOT_ACTIVE'; end if;
 if v_deadline is not null and now()>v_deadline then raise exception 'ATTEMPT_DEADLINE_PASSED'; end if;
 if not exists(select 1 from public.kf_questions q
   where q.id=p_question and q.package_id=v_package and q.type='esai')
 then raise exception 'INVALID_ESSAY_QUESTION'; end if;
 if v_path is not null then
   if v_path not like v_uid::text||'/'||p_attempt::text||'/'||p_question::text||'/%'
      or v_path like '%..%' then raise exception 'INVALID_ESSAY_FILE_PATH'; end if;
   if not exists(select 1 from storage.objects o
      where o.bucket_id='essay-submissions' and o.name=v_path)
   then raise exception 'ESSAY_FILE_NOT_FOUND'; end if;
 end if;
 insert into public.essay_submissions(participant_id,package_id,question_id,answer_text,answer_file_url)
 values(v_uid,v_package::text,p_question::text,coalesce(p_answer_text,''),coalesce(v_path,''))
 on conflict(participant_id,package_id,question_id)
 do update set answer_text=excluded.answer_text,answer_file_url=excluded.answer_file_url;
 return jsonb_build_object('ok',true,'attempt_id',p_attempt,'question_id',p_question);
end;
$$;

revoke all on function public.kf_save_essay_submission(uuid,uuid,text,text) from public;
revoke all on function public.kf_save_essay_submission(uuid,uuid,text,text) from anon;
grant execute on function public.kf_save_essay_submission(uuid,uuid,text,text) to authenticated;

drop policy if exists "KF essay admin select" on storage.objects;
create policy "KF essay admin select" on storage.objects for select to authenticated
using(bucket_id='essay-submissions' and public.kf_is_admin());

commit;

-- ================================================================
-- 4) VERIFIKASI — hasil bagian ini yang perlu diperiksa.
-- ================================================================

select 'BUCKET' check_type,id item,
       case when id='learning-files-private' and public=false then 'PASS' else 'CHECK' end result
from storage.buckets where id in('learning-files','learning-files-private','essay-submissions')
order by id;

select 'RLS' check_type,relname item,
       case when relrowsecurity then 'PASS' else 'FAIL' end result
from pg_class
where relnamespace='public'::regnamespace
and relname in(
 'member_admins','member_packages','member_package_topics','member_content',
 'member_content_packages','member_payment_methods','member_discount_rules',
 'member_admin_logs','kf_packages','kf_package_access','kf_questions',
 'kf_attempts','kf_answers','essay_submissions'
)
order by relname;

with required(name,anon_ok,auth_ok) as (
 values
 ('kf_username_available',false,true),('kf_member_package_catalog',false,true),
 ('kf_member_topics',false,true),('kf_payment_methods',false,true),
 ('kf_create_package_order',false,true),('kf_bundle_quote',false,true),
 ('kf_create_bundle_order',false,true),('kf_member_content_v2',false,true),
 ('touch_member_content',false,true),('admin_list_members_masked',false,true),
 ('admin_update_member',false,true),('admin_set_member_tahap',false,true),
 ('kf_admin_member_packages',false,true),('kf_admin_revoke_member_package',false,true),
 ('kf_admin_grant_member_package',false,true),('kf_admin_bundle_orders',false,true),
 ('kf_admin_bundle_order_items',false,true),('kf_admin_approve_bundle_order',false,true),
 ('kf_admin_cancel_bundle_order',false,true),('kf_admin_archive_bundle_order',false,true),
 ('kf_list_available_packages',false,true),('kf_start_attempt',false,true),
 ('kf_attempt_questions',false,true),('kf_save_answer',false,true),
 ('kf_save_essay_submission',false,true),('kf_submit_attempt_v13',false,true),
 ('kf_review_attempt',false,true),('kf_my_results',false,true)
),
x as (
 select r.*,p.oid,
   case when p.oid is null then null else has_function_privilege('anon',p.oid,'EXECUTE') end anon_exec,
   case when p.oid is null then null else has_function_privilege('authenticated',p.oid,'EXECUTE') end auth_exec
 from required r
 left join pg_proc p on p.proname=r.name
 left join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
)
select 'RPC' check_type,name item,
 case when oid is null then 'FAIL: MISSING'
      when anon_exec<>anon_ok then 'FAIL: ANON'
      when auth_exec<>auth_ok then 'FAIL: AUTH'
      else 'PASS' end result
from x
order by case when oid is null or anon_exec<>anon_ok or auth_exec<>auth_ok then 0 else 1 end,name;

select 'ESSAY_RPC' check_type,'kf_save_essay_submission' item,
 case when not has_function_privilege('anon','public.kf_save_essay_submission(uuid,uuid,text,text)','EXECUTE')
       and has_function_privilege('authenticated','public.kf_save_essay_submission(uuid,uuid,text,text)','EXECUTE')
      then 'PASS' else 'FAIL' end result;

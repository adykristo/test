-- KlinikFisikapku V15 — ESSAY FILE FINAL HARDENING
-- Memperketat kf_save_essay_submission tanpa mempercayai path dari browser.
begin;

create or replace function public.kf_save_essay_submission(
 p_attempt uuid,
 p_question uuid,
 p_answer_text text default '',
 p_answer_file_url text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=public,storage
as $$
declare
 v_uid uuid:=auth.uid();
 v_package uuid;
 v_status text;
 v_deadline timestamptz;
 v_path text:=nullif(trim(coalesce(p_answer_file_url,'')),'');
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

 select a.package_id,a.status,a.deadline_at
 into v_package,v_status,v_deadline
 from public.kf_attempts a
 where a.id=p_attempt and a.user_id=v_uid;

 if v_package is null then raise exception 'ATTEMPT_NOT_FOUND'; end if;
 if v_status<>'in_progress' then raise exception 'ATTEMPT_NOT_ACTIVE'; end if;
 if v_deadline is not null and now()>v_deadline then raise exception 'ATTEMPT_DEADLINE_PASSED'; end if;

 if not exists(
   select 1 from public.kf_questions q
   where q.id=p_question and q.package_id=v_package and q.type='esai'
 ) then raise exception 'INVALID_ESSAY_QUESTION'; end if;

 if v_path is not null then
   if v_path not like v_uid::text||'/'||p_attempt::text||'/'||p_question::text||'/%'
      or v_path like '%..%' then
     raise exception 'INVALID_ESSAY_FILE_PATH';
   end if;
   if not exists(
     select 1 from storage.objects o
     where o.bucket_id='essay-submissions' and o.name=v_path
   ) then
     raise exception 'ESSAY_FILE_NOT_FOUND';
   end if;
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
create policy "KF essay admin select"
on storage.objects for select to authenticated
using(bucket_id='essay-submissions' and public.kf_is_admin());

commit;

select
 has_function_privilege('anon','public.kf_save_essay_submission(uuid,uuid,text,text)','EXECUTE') anon_execute,
 has_function_privilege('authenticated','public.kf_save_essay_submission(uuid,uuid,text,text)','EXECUTE') authenticated_execute;

select policyname,cmd,roles
from pg_policies
where schemaname='storage' and tablename='objects'
and policyname='KF essay admin select';

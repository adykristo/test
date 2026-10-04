-- KlinikFisikapku V15/V13 — SECURITY REVIEW + RLS PATCH
-- WAJIB dijalankan di Supabase SQL Editor. Tidak menghapus data.
begin;
create or replace function public.kf_is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.member_admins where user_id=auth.uid() and active=true and role='super_admin');
$$;
revoke all on function public.kf_is_admin() from public;
grant execute on function public.kf_is_admin() to authenticated;

alter table public.kf_packages enable row level security;
alter table public.kf_questions enable row level security;
alter table public.kf_attempts enable row level security;
alter table public.kf_answers enable row level security;
alter table public.kf_package_access enable row level security;

drop policy if exists kf_questions_admin_all on public.kf_questions;
create policy kf_questions_admin_all on public.kf_questions for all to authenticated using(public.kf_is_admin()) with check(public.kf_is_admin());

drop policy if exists kf_packages_member_read on public.kf_packages;
create policy kf_packages_member_read on public.kf_packages for select to authenticated using(visible=true or public.kf_is_admin());
drop policy if exists kf_packages_admin_write on public.kf_packages;
create policy kf_packages_admin_write on public.kf_packages for all to authenticated using(public.kf_is_admin()) with check(public.kf_is_admin());

drop policy if exists kf_package_access_admin_all on public.kf_package_access;
create policy kf_package_access_admin_all on public.kf_package_access for all to authenticated using(public.kf_is_admin()) with check(public.kf_is_admin());

drop policy if exists kf_attempts_owner_read on public.kf_attempts;
create policy kf_attempts_owner_read on public.kf_attempts for select to authenticated using(user_id=auth.uid() or public.kf_is_admin());
drop policy if exists kf_answers_owner_read on public.kf_answers;
create policy kf_answers_owner_read on public.kf_answers for select to authenticated using(public.kf_is_admin() or exists(select 1 from public.kf_attempts a where a.id=kf_answers.attempt_id and a.user_id=auth.uid()));

revoke all on table public.kf_questions from anon;
revoke all on table public.kf_attempts from anon;
revoke all on table public.kf_answers from anon;
revoke all on table public.kf_package_access from anon;

create or replace function public.kf_review_attempt(p_attempt uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_attempt public.kf_attempts%rowtype; v_package public.kf_packages%rowtype; v_items jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_attempt from public.kf_attempts where id=p_attempt and user_id=v_uid;
 if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
 if v_attempt.status<>'submitted' then raise exception 'REVIEW_ONLY_AFTER_SUBMIT'; end if;
 select * into v_package from public.kf_packages where id=v_attempt.package_id;
 if not found then raise exception 'PACKAGE_NOT_FOUND'; end if;
 if v_package.kind='tryout' and v_package.ends_at is not null and now()<v_package.ends_at then
  return jsonb_build_object('locked',true,'ends_at',v_package.ends_at,'items','[]'::jsonb);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'question',jsonb_build_object('id',q.id,'position',q.position,'type',q.type,'question',q.question,'image',q.image,'options',coalesce(q.options,'[]'::jsonb),'statements',coalesce(q.statements,'[]'::jsonb),'category_labels',coalesce(q.category_labels,'[]'::jsonb),'answer_key',q.answer_key,'explanation',coalesce(q.explanation,'')),
  'answer',case when a.question_id is null then null else jsonb_build_object('question_id',a.question_id,'answer',a.answer,'is_correct',public.kf_is_correct(q.type,q.answer_key,a.answer),'score',case when public.kf_is_correct(q.type,q.answer_key,a.answer) then coalesce(q.points,1) else 0 end) end
 ) order by q.position),'[]'::jsonb) into v_items
 from public.kf_questions q left join public.kf_answers a on a.attempt_id=v_attempt.id and a.question_id=q.id
 where q.package_id=v_attempt.package_id;
 return jsonb_build_object('locked',false,'score',v_attempt.score,'kind',v_package.kind,'name',v_package.name,'items',v_items);
end; $$;
revoke all on function public.kf_review_attempt(uuid) from public;
grant execute on function public.kf_review_attempt(uuid) to authenticated;
revoke all on function public.kf_attempt_questions(uuid) from public;
grant execute on function public.kf_attempt_questions(uuid) to authenticated;
commit;

select relname table_name,relrowsecurity rls_enabled from pg_class
where relnamespace='public'::regnamespace and relname in ('kf_packages','kf_questions','kf_attempts','kf_answers','kf_package_access') order by relname;
select tablename,policyname,cmd,roles from pg_policies where schemaname='public'
and tablename in ('kf_packages','kf_questions','kf_attempts','kf_answers','kf_package_access') order by tablename,policyname;

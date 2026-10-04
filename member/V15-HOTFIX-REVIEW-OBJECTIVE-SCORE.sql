-- KlinikFisikapku V15 — HOTFIX PEMBAHASAN
-- Memperbaiki: record "v_attempt" has no field "score"
-- Aman: tidak mengubah tabel/data, hanya mengganti fungsi review.

create or replace function public.kf_review_attempt(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_attempt public.kf_attempts%rowtype;
  v_package public.kf_packages%rowtype;
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_attempt
  from public.kf_attempts
  where id=p_attempt and user_id=v_uid;

  if not found then raise exception 'ATTEMPT_NOT_FOUND'; end if;
  if v_attempt.status<>'submitted' then raise exception 'REVIEW_ONLY_AFTER_SUBMIT'; end if;

  select * into v_package
  from public.kf_packages
  where id=v_attempt.package_id;

  if not found then raise exception 'PACKAGE_NOT_FOUND'; end if;

  if v_package.kind='tryout'
     and v_package.ends_at is not null
     and now()<v_package.ends_at then
    return jsonb_build_object(
      'locked',true,
      'ends_at',v_package.ends_at,
      'items','[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question',jsonb_build_object(
          'id',q.id,'position',q.position,'type',q.type,
          'question',q.question,'image',q.image,
          'options',coalesce(q.options,'[]'::jsonb),
          'statements',coalesce(q.statements,'[]'::jsonb),
          'category_labels',coalesce(q.category_labels,'[]'::jsonb),
          'answer_key',q.answer_key,
          'explanation',coalesce(q.explanation,'')
        ),
        'answer',case when a.question_id is null then null else jsonb_build_object(
          'question_id',a.question_id,
          'answer',a.answer,
          'is_correct',case
            when q.type in ('pg4','pg5') then coalesce(a.answer,'null'::jsonb)=q.answer_key
            when q.type='isian' then public.kf_norm(a.answer#>>'{}')=public.kf_norm(q.answer_key#>>'{}')
            when q.type='mcma' then
              (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) from jsonb_array_elements(coalesce(a.answer,'[]'::jsonb)) e(v))
              =
              (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) from jsonb_array_elements(coalesce(q.answer_key,'[]'::jsonb)) e(v))
            else null
          end,
          'score',coalesce(a.auto_score,0)
        ) end
      ) order by q.position
    ),'[]'::jsonb
  ) into v_items
  from public.kf_questions q
  left join public.kf_answers a
    on a.attempt_id=v_attempt.id and a.question_id=q.id
  where q.package_id=v_attempt.package_id;

  return jsonb_build_object(
    'locked',false,
    'score',coalesce(v_attempt.objective_score,0),
    'kind',v_package.kind,
    'name',v_package.name,
    'items',v_items
  );
end;
$$;

revoke all on function public.kf_review_attempt(uuid) from public, anon;
grant execute on function public.kf_review_attempt(uuid) to authenticated;

select
  case
    when pg_get_functiondef('public.kf_review_attempt(uuid)'::regprocedure)
         like '%v_attempt.objective_score%'
    then 'PASS'
    else 'FAIL'
  end as review_objective_score_hotfix;

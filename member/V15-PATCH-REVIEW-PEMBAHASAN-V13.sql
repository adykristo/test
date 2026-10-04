-- KlinikFisikapku — PATCH REVIEW PEMBAHASAN V13
-- Memperbaiki error: column a.is_correct does not exist
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Tidak menghapus data peserta, paket, soal, attempt, atau jawaban.

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
          'id',q.id,
          'position',q.position,
          'type',q.type,
          'question',q.question,
          'image',q.image,
          'options',coalesce(q.options,'[]'::jsonb),
          'statements',coalesce(q.statements,'[]'::jsonb),
          'category_labels',coalesce(q.category_labels,'[]'::jsonb),
          'answer_key',q.answer_key,
          'explanation',coalesce(q.explanation,'')
        ),
        'answer',
          case when a.question_id is null then null
          else jsonb_build_object(
            'question_id',a.question_id,
            'answer',a.answer,
            'is_correct',public.kf_is_correct(q.type,q.answer_key,a.answer),
            'score',case
              when public.kf_is_correct(q.type,q.answer_key,a.answer)
              then coalesce(q.points,1)
              else 0
            end
          )
          end
      )
      order by q.position
    ),
    '[]'::jsonb
  )
  into v_items
  from public.kf_questions q
  left join public.kf_answers a
    on a.attempt_id=v_attempt.id
   and a.question_id=q.id
  where q.package_id=v_attempt.package_id;

  return jsonb_build_object(
    'locked',false,
    'score',v_attempt.score,
    'kind',v_package.kind,
    'name',v_package.name,
    'items',v_items
  );
end;
$$;

revoke all on function public.kf_review_attempt(uuid) from public;
grant execute on function public.kf_review_attempt(uuid) to authenticated;

-- Verifikasi fungsi berhasil dibuat.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname='kf_review_attempt';

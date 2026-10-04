-- KlinikFisikapku V15 — FINAL FIX LATIHAN + TRYOUT
-- Tujuan: menyelaraskan schema kf_answers dengan submit/review V13 aktif.
-- Tidak menghapus paket, soal, attempt, jawaban, peserta, atau data lama.
-- Aman dijalankan berulang.

begin;

-- Kolom yang memang digunakan engine submit V13.
alter table public.kf_answers
  add column if not exists auto_score numeric,
  add column if not exists needs_manual_review boolean not null default false;

-- Pastikan scoring question tersedia untuk MCMA exact/partial.
alter table public.kf_questions
  add column if not exists scoring text default 'exact';

create or replace function public.kf_submit_attempt_v13(p_attempt uuid, p_auto boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.kf_attempts;
  q record;
  ans jsonb;
  earned numeric := 0;
  total integer := 0;
  s numeric := 0;
  i integer;
  expected text;
  chosen jsonb;
  correct_count integer;
  hit_count integer;
  wrong_count integer;
begin
  select * into a
  from public.kf_attempts
  where id=p_attempt and user_id=auth.uid();

  if a.id is null then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;

  if a.status='submitted' then
    return jsonb_build_object(
      'score', coalesce(a.objective_score,0),
      'essay_count', (
        select count(*) from public.kf_questions
        where package_id=a.package_id and type='esai'
      ),
      'already_submitted', true
    );
  end if;

  for q in
    select * from public.kf_questions
    where package_id=a.package_id
    order by position
  loop
    select answer into ans
    from public.kf_answers
    where attempt_id=a.id and question_id=q.id;

    if q.type in ('pg4','pg5') then
      total := total + 1;
      s := case when coalesce(ans,'null'::jsonb)=q.answer_key then 1 else 0 end;
      earned := earned + s;

    elsif q.type='mcma' then
      total := total + 1;
      chosen := coalesce(ans,'[]'::jsonb);

      if coalesce(q.scoring,'exact')='partial' then
        correct_count := jsonb_array_length(coalesce(q.answer_key,'[]'::jsonb));

        select count(*) into hit_count
        from jsonb_array_elements(chosen) c(v)
        where exists (
          select 1 from jsonb_array_elements(coalesce(q.answer_key,'[]'::jsonb)) k(v)
          where k.v=c.v
        );

        select count(*) into wrong_count
        from jsonb_array_elements(chosen) c(v)
        where not exists (
          select 1 from jsonb_array_elements(coalesce(q.answer_key,'[]'::jsonb)) k(v)
          where k.v=c.v
        );

        if correct_count > 0 then
          s := greatest(0::numeric,(hit_count-wrong_count)::numeric/correct_count::numeric);
        else
          s := 0;
        end if;
      else
        -- Exact MCMA: urutan pilihan tidak memengaruhi nilai.
        s := case when
          (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb)
             from jsonb_array_elements(chosen) e(v))
          =
          (select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb)
             from jsonb_array_elements(coalesce(q.answer_key,'[]'::jsonb)) e(v))
        then 1 else 0 end;
      end if;
      earned := earned + s;

    elsif q.type='isian' then
      total := total + 1;
      s := case when public.kf_norm(ans#>>'{}')=public.kf_norm(q.answer_key#>>'{}') then 1 else 0 end;
      earned := earned + s;

    elsif q.type='kategori' then
      total := total + 1;
      s := 0;
      if jsonb_array_length(coalesce(q.answer_key,'[]'::jsonb)) > 0 then
        for i in 0..jsonb_array_length(q.answer_key)-1 loop
          expected := q.answer_key->>i;
          if coalesce(ans->>i,'')=expected then
            s := s + 1;
          end if;
        end loop;
        s := s / jsonb_array_length(q.answer_key);
      end if;
      earned := earned + s;

    elsif q.type='esai' then
      -- Esai tidak masuk objective_score; disimpan untuk penilaian guru.
      null;
    end if;

    insert into public.kf_answers(
      attempt_id,question_id,answer,auto_score,needs_manual_review
    )
    values(
      a.id,q.id,coalesce(ans,'null'::jsonb),
      case when q.type='esai' then null else s end,
      q.type='esai'
    )
    on conflict (attempt_id,question_id)
    do update set
      auto_score=excluded.auto_score,
      needs_manual_review=excluded.needs_manual_review;
  end loop;

  update public.kf_attempts
  set status='submitted',
      submitted_at=now(),
      objective_score=case when total>0 then round(earned*100/total,2) else 0 end,
      auto_submitted=coalesce(p_auto,false)
  where id=a.id;

  return jsonb_build_object(
    'score',case when total>0 then round(earned*100/total,2) else 0 end,
    'essay_count',(
      select count(*) from public.kf_questions
      where package_id=a.package_id and type='esai'
    )
  );
end
$function$;

revoke all on function public.kf_submit_attempt_v13(uuid,boolean) from public;
grant execute on function public.kf_submit_attempt_v13(uuid,boolean) to authenticated;

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



-- Kunci akses RPC produksi.
revoke all on function public.kf_submit_attempt_v13(uuid,boolean) from public, anon;
grant execute on function public.kf_submit_attempt_v13(uuid,boolean) to authenticated;
revoke all on function public.kf_review_attempt(uuid) from public, anon;
grant execute on function public.kf_review_attempt(uuid) to authenticated;

commit;

-- Verifikasi ringkas: semua harus PASS.
with checks(name,ok) as (
 values
 ('kf_answers.auto_score',exists(select 1 from information_schema.columns where table_schema='public' and table_name='kf_answers' and column_name='auto_score')),
 ('kf_answers.needs_manual_review',exists(select 1 from information_schema.columns where table_schema='public' and table_name='kf_answers' and column_name='needs_manual_review')),
 ('kf_questions.scoring',exists(select 1 from information_schema.columns where table_schema='public' and table_name='kf_questions' and column_name='scoring')),
 ('submit_v13_auth',has_function_privilege('authenticated','public.kf_submit_attempt_v13(uuid,boolean)','EXECUTE')),
 ('submit_v13_anon_blocked',not has_function_privilege('anon','public.kf_submit_attempt_v13(uuid,boolean)','EXECUTE')),
 ('review_auth',has_function_privilege('authenticated','public.kf_review_attempt(uuid)','EXECUTE')),
 ('review_anon_blocked',not has_function_privilege('anon','public.kf_review_attempt(uuid)','EXECUTE'))
)
select name,case when ok then 'PASS' else 'FAIL' end result from checks;

-- KlinikFisikapku V15/V13 — PATCH PENILAIAN MCMA EXACT + PARTIAL
-- Jalankan di Supabase SQL Editor.
-- Patch ini mempertahankan pola fungsi produksi yang sudah ada dan menambah scoring MCMA.
-- Prasyarat: kf_questions memiliki kolom scoring (publisher V13 sudah mengisinya).

begin;

create or replace function public.kf_submit_attempt(p_attempt uuid, p_auto boolean default false)
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

revoke all on function public.kf_submit_attempt(uuid,boolean) from public;
grant execute on function public.kf_submit_attempt(uuid,boolean) to authenticated;

commit;

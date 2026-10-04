-- KlinikFisikapku V15/V13 — SECURITY PATCH RPC TRYOUT
-- Jalankan di Supabase SQL Editor setelah instalasi tabel kf_packages/kf_questions/kf_attempts.
-- Tujuan: peserta TIDAK pernah menerima answer_key / explanation sebelum submit.

begin;

create or replace function public.kf_attempt_questions(p_attempt uuid)
returns table(
  question_id uuid,
  question_position integer,
  question_type text,
  topic text,
  question text,
  image text,
  options jsonb,
  statements jsonb,
  category_labels jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.kf_attempts a
    join public.kf_packages p on p.id=a.package_id
    where a.id=p_attempt
      and a.user_id=v_user
      and p.visible=true
      and (p.starts_at is null or p.starts_at<=now())
      and (p.ends_at is null or p.ends_at>=now())
  ) then
    raise exception 'ATTEMPT_NOT_AVAILABLE';
  end if;

  return query
  select
    q.id,
    q.position,
    q.type,
    q.topic,
    q.question,
    q.image,
    coalesce(q.options,'[]'::jsonb),
    -- Hanya teks pernyataan. Field key/jawaban sengaja dibuang.
    coalesce((
      select jsonb_agg(jsonb_build_object('text', coalesce(s.item->>'text','')) order by s.ord)
      from jsonb_array_elements(coalesce(q.statements,'[]'::jsonb)) with ordinality s(item,ord)
    ),'[]'::jsonb),
    coalesce(q.category_labels,'[]'::jsonb)
  from public.kf_attempts a
  join public.kf_questions q on q.package_id=a.package_id
  where a.id=p_attempt and a.user_id=v_user
  order by q.position;
end;
$$;

revoke all on function public.kf_attempt_questions(uuid) from public;
grant execute on function public.kf_attempt_questions(uuid) to authenticated;

commit;

-- Verifikasi desain:
-- 1. Output fungsi di atas TIDAK memiliki kolom answer_key.
-- 2. Output fungsi di atas TIDAK memiliki kolom explanation.
-- 3. statements dibentuk ulang hanya dengan field text.
-- 4. Penilaian tetap harus dilakukan server-side oleh kf_submit_attempt.

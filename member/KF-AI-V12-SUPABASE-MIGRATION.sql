-- KlinikFisikapku — AI + V12 publication hardening
-- Jalankan sekali di Supabase SQL Editor.
-- Tidak menyimpan API key AI. API key tetap di Script Properties Google Apps Script.

alter table if exists public.kf_packages
  add column if not exists source_version integer not null default 1,
  add column if not exists published_at timestamptz,
  add column if not exists ai_provider text,
  add column if not exists review_status text not null default 'reviewed';

alter table if exists public.kf_questions
  add column if not exists ai_provider text,
  add column if not exists review_status text not null default 'reviewed',
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists kf_questions_package_position_idx
  on public.kf_questions(package_id, position);

create index if not exists kf_packages_kind_visible_idx
  on public.kf_packages(kind, visible);

comment on column public.kf_questions.answer_key is
  'Kunci jawaban final. Jangan expose lewat SELECT publik; peserta mengambil soal melalui RPC attempt.';
comment on column public.kf_questions.explanation is
  'Pembahasan final. Buka ke peserta hanya sesuai kebijakan hasil/pembahasan.';

-- Audit view admin saja. RLS tabel sumber tetap berlaku.
create or replace view public.kf_admin_question_publication_audit
with (security_invoker = true)
as
select
  p.id as package_id,
  p.external_id,
  p.name,
  p.kind,
  p.visible,
  p.source,
  p.ai_provider,
  p.review_status,
  p.published_at,
  p.updated_at,
  count(q.id) as question_count,
  count(q.id) filter (where coalesce(q.explanation,'') <> '') as explanation_count
from public.kf_packages p
left join public.kf_questions q on q.package_id=p.id
group by p.id;

revoke all on public.kf_admin_question_publication_audit from anon;

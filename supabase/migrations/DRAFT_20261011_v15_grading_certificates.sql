-- KlinikFisikapku V15: additive grading schema, staging review required.
-- DOES NOT alter existing kf_attempts / kf_answers / kf_essay_manual_grades.
-- Execute ONLY after schema review and restore-test of backups.
begin;
create table if not exists public.kf_v15_grading_policies (
  id uuid primary key default gen_random_uuid(),
  assessment_key text not null unique,
  weights jsonb not null,
  passing_score numeric(5,2) not null default 75 check (passing_score between 0 and 100),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(weights) = 'object')
);
create table if not exists public.kf_v15_published_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null references auth.users(id),
  assessment_key text not null,
  policy_version integer not null check (policy_version > 0),
  score numeric(5,2) not null check (score between 0 and 100),
  score_components jsonb not null,
  published_at timestamptz not null default now(),
  supersedes_id uuid references public.kf_v15_published_results(id),
  published_by uuid not null references auth.users(id)
);
create unique index if not exists kf_v15_result_initial_once on public.kf_v15_published_results(attempt_id) where supersedes_id is null;
create index if not exists kf_v15_result_user on public.kf_v15_published_results(user_id,published_at desc);
create table if not exists public.kf_v15_package_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  jenjang text not null check (jenjang in ('SD','SMP','SMA')),
  package_no integer not null check (package_no between 1 and 12),
  published_result_id uuid not null references public.kf_v15_published_results(id),
  certificate_number text not null unique,
  verification_token uuid not null default gen_random_uuid() unique,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  replaced_by uuid references public.kf_v15_package_certificates(id)
);
create unique index if not exists kf_v15_one_active_certificate_per_package
 on public.kf_v15_package_certificates(user_id,jenjang,package_no) where revoked_at is null;
alter table public.kf_v15_grading_policies enable row level security;
alter table public.kf_v15_published_results enable row level security;
alter table public.kf_v15_package_certificates enable row level security;
-- No public/admin write policies: only controlled SECURITY DEFINER RPCs after role audit.
revoke all on public.kf_v15_grading_policies from anon, authenticated;
revoke all on public.kf_v15_published_results from anon, authenticated;
revoke all on public.kf_v15_package_certificates from anon, authenticated;
-- Owner-scoped SELECT only. No certificate-public SELECT; verification via narrow RPC later.
grant select on public.kf_v15_published_results to authenticated;
grant select on public.kf_v15_package_certificates to authenticated;
drop policy if exists kf_v15_results_owner_read on public.kf_v15_published_results;
create policy kf_v15_results_owner_read on public.kf_v15_published_results
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists kf_v15_certs_owner_read on public.kf_v15_package_certificates;
create policy kf_v15_certs_owner_read on public.kf_v15_package_certificates
for select to authenticated using (user_id = (select auth.uid()));
commit;

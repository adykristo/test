-- KlinikFisikapku — Struktur Paket > Topik > Subtopik
-- Jalankan sekali di Supabase SQL Editor.

create table if not exists public.member_package_subtopics (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.member_packages(id) on delete cascade,
  topic_id uuid not null references public.member_package_topics(id) on delete cascade,
  judul text not null,
  deskripsi text default '',
  urutan integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_package_subtopics_judul_nonempty check (length(trim(judul)) > 0)
);
create index if not exists idx_member_package_subtopics_package on public.member_package_subtopics(package_id);
create index if not exists idx_member_package_subtopics_topic on public.member_package_subtopics(topic_id);
create unique index if not exists uq_member_package_subtopics_topic_judul
  on public.member_package_subtopics(topic_id, lower(trim(judul)));

alter table public.member_package_subtopics enable row level security;

drop policy if exists "subtopics_authenticated_read" on public.member_package_subtopics;
create policy "subtopics_authenticated_read" on public.member_package_subtopics
for select to authenticated using (true);

drop policy if exists "subtopics_authenticated_manage" on public.member_package_subtopics;
create policy "subtopics_authenticated_manage" on public.member_package_subtopics
for all to authenticated using (true) with check (true);

-- Konten Modul / Video / Latihan PDF memakai subtopik yang sama.
alter table public.member_content_packages
  add column if not exists subtopic_id uuid null references public.member_package_subtopics(id) on delete set null;
create index if not exists idx_member_content_packages_subtopic on public.member_content_packages(subtopic_id);

-- Latihan Interaktif V14 / Tryout V14 tetap memakai kf_package_access,
-- tetapi sekarang relasinya juga dapat menunjuk Topik + Subtopik.
alter table public.kf_package_access
  add column if not exists topic_id uuid null references public.member_package_topics(id) on delete set null;
alter table public.kf_package_access
  add column if not exists subtopic_id uuid null references public.member_package_subtopics(id) on delete set null;
create index if not exists idx_kf_package_access_topic on public.kf_package_access(topic_id);
create index if not exists idx_kf_package_access_subtopic on public.kf_package_access(subtopic_id);

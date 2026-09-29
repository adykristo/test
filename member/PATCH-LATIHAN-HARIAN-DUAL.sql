-- KlinikFisikapku — Patch Latihan Harian Dual (PDF + Interaktif)
begin;

-- RLS tidak menggantikan privilege tabel. Admin browser authenticated tetap memerlukan grant dasar.
grant select, insert, update, delete on public.member_question_bank to authenticated;
grant select, insert, update, delete on public.member_question_sets to authenticated;
grant select, insert, update, delete on public.member_question_set_items to authenticated;
grant select, insert, update, delete on public.member_question_versions to authenticated;
grant select, insert, update, delete on public.member_package_access to authenticated;
grant select, insert, update, delete on public.member_set_answers to authenticated;

create table if not exists public.member_daily_training (
  id uuid primary key default gen_random_uuid(),
  jenjang text not null check (jenjang in ('sd','smp','sma')),
  package_name text not null,
  training_date date not null,
  title text not null,
  pdf_url text,
  interactive_set_id uuid references public.member_question_sets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(jenjang,package_name,training_date)
);
create index if not exists idx_daily_training_lookup on public.member_daily_training(jenjang,package_name,training_date,status);
alter table public.member_daily_training enable row level security;
grant select,insert,update,delete on public.member_daily_training to authenticated;

drop policy if exists "admin manage daily training" on public.member_daily_training;
create policy "admin manage daily training" on public.member_daily_training for all to authenticated
using(public.kf_member_is_admin()) with check(public.kf_member_is_admin());

-- Peserta hanya membaca jadwal terbit yang sesuai akses paket aktifnya.
drop policy if exists "member read eligible daily training" on public.member_daily_training;
create policy "member read eligible daily training" on public.member_daily_training for select to authenticated
using (
  status='published' and exists(
    select 1 from public.member_package_access a
    where a.user_id=auth.uid() and a.status='active'
      and a.jenjang=member_daily_training.jenjang
      and a.package_name=member_daily_training.package_name
      and (a.expires_at is null or a.expires_at>now())
  )
);

commit;

select table_name from information_schema.tables where table_schema='public' and table_name='member_daily_training';

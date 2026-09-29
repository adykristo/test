-- KlinikFisikapku: ekstensi platform pelatihan 12 bulan
-- Jalankan SETELAH supabase-setup-final.sql / database produksi yang sudah aktif.

alter table public.member_packages add column if not exists jenjang text;
alter table public.member_packages add column if not exists bulan int;
alter table public.member_packages add column if not exists tipe text default 'bulanan';
alter table public.member_packages add column if not exists prasyarat text;
alter table public.member_packages add column if not exists urutan int default 0;

create table if not exists public.member_package_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_name text not null,
  status text not null default 'pending' check (status in ('pending','active','completed','expired','rejected','locked')),
  started_at timestamptz,
  expires_at timestamptz,
  activated_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, package_name)
);

create table if not exists public.member_question_bank (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  jenjang text not null check (jenjang in ('sd','smp','sma')),
  bidang text default 'Fisika',
  topik text not null default 'Umum',
  subtopik text default '',
  difficulty text not null default 'Sedang',
  question_type text not null default 'pg5',
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb,
  explanation text default '',
  image_url text default '',
  source text not null default 'manual',
  status text not null default 'draft' check (status in ('draft','validated','archived')),
  version int not null default 1,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  set_type text not null check (set_type in ('daily','tryout')),
  jenjang text not null check (jenjang in ('sd','smp','sma')),
  package_name text,
  scheduled_at timestamptz,
  duration_minutes int,
  randomize_questions boolean not null default false,
  randomize_options boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_question_set_items (
  set_id uuid not null references public.member_question_sets(id) on delete cascade,
  question_id uuid not null references public.member_question_bank(id) on delete restrict,
  position int not null default 0,
  snapshot jsonb,
  primary key(set_id, question_id)
);

alter table public.member_package_access enable row level security;
alter table public.member_question_bank enable row level security;
alter table public.member_question_sets enable row level security;
alter table public.member_question_set_items enable row level security;

create or replace function public.kf_member_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role in ('super_admin','content_admin'));
$$;

-- Admin dapat mengelola data operasional; peserta hanya membaca akses paket miliknya.
drop policy if exists "admin manage package access" on public.member_package_access;
create policy "admin manage package access" on public.member_package_access for all using (public.kf_member_is_admin()) with check (public.kf_member_is_admin());
drop policy if exists "member read own package access" on public.member_package_access;
create policy "member read own package access" on public.member_package_access for select using (auth.uid()=user_id);

drop policy if exists "admin manage question bank" on public.member_question_bank;
create policy "admin manage question bank" on public.member_question_bank for all using (public.kf_member_is_admin()) with check (public.kf_member_is_admin());
drop policy if exists "admin manage question sets" on public.member_question_sets;
create policy "admin manage question sets" on public.member_question_sets for all using (public.kf_member_is_admin()) with check (public.kf_member_is_admin());
drop policy if exists "admin manage question set items" on public.member_question_set_items;
create policy "admin manage question set items" on public.member_question_set_items for all using (public.kf_member_is_admin()) with check (public.kf_member_is_admin());

create index if not exists idx_qbank_filter on public.member_question_bank(jenjang,topik,difficulty,status);
create index if not exists idx_qsets_package on public.member_question_sets(jenjang,package_name,set_type,status);
create index if not exists idx_package_access_user on public.member_package_access(user_id,status);
alter table public.member_profiles add column if not exists kota text default '';

-- Sinkronisasi field Kota untuk pendaftaran baru.
create or replace function public.handle_new_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_jenjang text; v_username text; v_kelas text;
begin
  if lower(coalesce(new.email,'')) !~ '^[^@]+@gmail\.com$' then raise exception 'Gunakan email Google (@gmail.com)'; end if;
  v_jenjang := lower(coalesce(new.raw_user_meta_data->>'jenjang',''));
  if v_jenjang not in ('','sd','smp','sma') then v_jenjang := ''; end if;
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  v_kelas := trim(coalesce(new.raw_user_meta_data->>'kelas',''));
  if v_username !~ '^[a-z0-9._]{4,30}$' then raise exception 'Username tidak valid'; end if;
  if v_kelas !~ '^(1|2|3|4|5|6|7|8|9|10|11|12)$' then raise exception 'Kelas tidak valid'; end if;
  insert into public.member_profiles(id,email,nama,username,kelas,wa,sekolah,kota,jenjang,paket)
  values(new.id,left(coalesce(new.email,''),254),left(trim(coalesce(new.raw_user_meta_data->>'nama',new.raw_user_meta_data->>'full_name','')),100),v_username,v_kelas,left(trim(coalesce(new.raw_user_meta_data->>'wa','')),25),left(trim(coalesce(new.raw_user_meta_data->>'sekolah','')),150),left(trim(coalesce(new.raw_user_meta_data->>'kota','')),100),v_jenjang,left(trim(coalesce(new.raw_user_meta_data->>'paket','')),80))
  on conflict (id) do nothing;
  return new;
end; $$;

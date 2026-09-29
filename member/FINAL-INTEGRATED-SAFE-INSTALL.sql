-- KlinikFisikapku FINAL-INTEGRATED SAFE INSTALL
-- Versi perbaikan: 2026-09-29
-- Tujuan: dapat dijalankan pada database KlinikFisikapku yang sudah memakai supabase-setup-final.sql.
-- File ini menggabungkan migrasi fondasi + FINAL-INTEGRATED dalam urutan yang benar.
-- Bersifat idempotent untuk CREATE TABLE / ADD COLUMN / policy / function utama.

begin;

-- =========================================================
-- A. FONDASI PLATFORM 12 BULAN (WAJIB DIBUAT TERLEBIH DAHULU)
-- =========================================================

alter table public.member_packages add column if not exists jenjang text;
alter table public.member_packages add column if not exists bulan int;
alter table public.member_packages add column if not exists tipe text default 'bulanan';
alter table public.member_packages add column if not exists prasyarat text;
alter table public.member_packages add column if not exists urutan int default 0;
alter table public.member_profiles add column if not exists kota text default '';

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

-- Kolom tambahan FINAL-INTEGRATED, baru ditambahkan setelah tabelnya pasti ada.
alter table public.member_question_sets add column if not exists explanation_release_at timestamptz;
alter table public.member_question_sets add column if not exists instructions text default '';
alter table public.member_question_sets add column if not exists max_attempts int default 1;
alter table public.member_question_sets add column if not exists passing_score numeric default 0;
alter table public.member_question_sets add column if not exists published_at timestamptz;
alter table public.member_question_bank add column if not exists explanation_image_url text default '';
alter table public.member_question_bank add column if not exists option_images jsonb not null default '[]'::jsonb;
alter table public.member_question_bank add column if not exists validation_notes text default '';

create table if not exists public.member_question_versions(
 id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.member_question_bank(id) on delete cascade,
 version int not null,
 snapshot jsonb not null,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(question_id,version)
);

create table if not exists public.member_set_answers(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 set_id uuid not null references public.member_question_sets(id) on delete cascade,
 question_id uuid not null references public.member_question_bank(id) on delete restrict,
 answer jsonb,
 correct boolean,
 score numeric default 0,
 created_at timestamptz not null default now()
);

create index if not exists idx_qbank_filter on public.member_question_bank(jenjang,topik,difficulty,status);
create index if not exists idx_qsets_package on public.member_question_sets(jenjang,package_name,set_type,status);
create index if not exists idx_package_access_user on public.member_package_access(user_id,status);
create index if not exists idx_set_answers_user on public.member_set_answers(user_id,set_id,created_at desc);

-- =========================================================
-- B. RLS DAN HAK AKSES
-- =========================================================

alter table public.member_package_access enable row level security;
alter table public.member_question_bank enable row level security;
alter table public.member_question_sets enable row level security;
alter table public.member_question_set_items enable row level security;
alter table public.member_question_versions enable row level security;
alter table public.member_set_answers enable row level security;

create or replace function public.kf_member_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.member_admins a
    where a.user_id=auth.uid() and a.active=true
      and a.role in ('super_admin','content_admin')
  );
$$;

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
drop policy if exists "admin manage question versions" on public.member_question_versions;
create policy "admin manage question versions" on public.member_question_versions for all using(public.kf_member_is_admin()) with check(public.kf_member_is_admin());
drop policy if exists "member read own set answers" on public.member_set_answers;
create policy "member read own set answers" on public.member_set_answers for select using(auth.uid()=user_id);
drop policy if exists "admin manage set answers" on public.member_set_answers;
create policy "admin manage set answers" on public.member_set_answers for all using(public.kf_member_is_admin()) with check(public.kf_member_is_admin());

-- =========================================================
-- C. VERSIONING BANK SOAL
-- =========================================================

create or replace function public.kf_question_version_before_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if row_to_json(old)::jsonb is distinct from row_to_json(new)::jsonb then
   insert into public.member_question_versions(question_id,version,snapshot,created_by)
   values(old.id,old.version,to_jsonb(old),auth.uid()) on conflict do nothing;
   new.version:=old.version+1;
   new.updated_by:=auth.uid();
   new.updated_at:=now();
 end if;
 return new;
end $$;

drop trigger if exists trg_kf_question_version on public.member_question_bank;
create trigger trg_kf_question_version before update on public.member_question_bank
for each row execute function public.kf_question_version_before_update();

-- =========================================================
-- D. KONTEN SOAL YANG BOLEH DILIHAT MEMBER
-- Kunci dan pembahasan sengaja tidak dikirim di sini.
-- =========================================================

create or replace function public.kf_member_question_content() returns setof jsonb
language sql volatile security definer set search_path=public as $$
with me as (
 select p.id,p.jenjang,p.paket,p.status,p.berakhir
 from member_profiles p where p.id=auth.uid()
), allowed as (
 select s.* from member_question_sets s, me
 where me.status='aktif'
   and (me.berakhir is null or me.berakhir>now())
   and s.jenjang=me.jenjang
   and s.status in ('published','scheduled')
   and (s.scheduled_at is null or s.scheduled_at<=now())
   and (
     coalesce(s.package_name,'')=''
     or s.package_name=me.paket
     or exists(
       select 1 from member_package_access a
       where a.user_id=me.id
         and a.package_name=s.package_name
         and a.status='active'
         and (a.expires_at is null or a.expires_at>now())
     )
   )
)
select jsonb_build_object(
 'id','qset:'||s.id::text||':'||q.id::text,
 'source_type','question_set','set_id',s.id,'question_id',q.id,
 'jenis','soal','tujuan',case when s.set_type='tryout' then 'tryout' else 'latihan' end,
 'topik',s.name,'judul',coalesce(nullif(q.subtopik,''),q.topik),
 'jenjang',s.jenjang,'tipe',q.question_type,
 'soal',q.stem,'opsi',q.options,'gambar',q.image_url,'option_images',q.option_images,
 'visible',true,'scheduled_at',s.scheduled_at,'duration_minutes',s.duration_minutes,
 'learning_stage',coalesce((select mp.bulan from member_packages mp where mp.nama=s.package_name limit 1),1)
)
from allowed s
join member_question_set_items i on i.set_id=s.id
join member_question_bank q on q.id=i.question_id
where q.status='validated'
order by s.scheduled_at nulls first,
         case when s.randomize_questions then random() else i.position::double precision end;
$$;

grant execute on function public.kf_member_question_content() to authenticated;

-- =========================================================
-- E. PEMERIKSAAN JAWABAN + PEMBAHASAN
-- =========================================================

create or replace function public.kf_check_set_answer(p_set_id uuid,p_question_id uuid,p_answer jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 s public.member_question_sets%rowtype;
 q public.member_question_bank%rowtype;
 ok boolean:=false;
 release boolean:=true;
 ans jsonb;
 expected jsonb;
begin
 select * into s from public.member_question_sets where id=p_set_id;
 if not found then raise exception 'Set soal tidak ditemukan'; end if;

 if not exists(
   select 1 from public.kf_member_question_content() as x(item)
   where item->>'set_id'=p_set_id::text
     and item->>'question_id'=p_question_id::text
 ) then
   raise exception 'Soal belum dapat diakses';
 end if;

 select * into q from public.member_question_bank where id=p_question_id;
 if not found then raise exception 'Soal tidak ditemukan'; end if;

 expected:=q.answer;
 ans:=p_answer;

 -- Perbandingan JSONB langsung aman untuk PG tunggal dan array MCMA yang sudah dinormalisasi UI.
 ok := expected = ans;

 insert into public.member_set_answers(user_id,set_id,question_id,answer,correct,score)
 values(auth.uid(),p_set_id,p_question_id,ans,ok,case when ok then 100 else 0 end);

 release := s.set_type='daily'
            or (s.explanation_release_at is not null and now()>=s.explanation_release_at);

 return jsonb_build_object(
   'benar',ok,
   'review_locked',not release,
   'kunci',case when release then q.answer else null end,
   'pembahasan',case when release then q.explanation else null end,
   'explanation_image_url',case when release then q.explanation_image_url else null end
 );
end $$;

grant execute on function public.kf_check_set_answer(uuid,uuid,jsonb) to authenticated;

-- =========================================================
-- F. PUBLIKASI SET SOAL
-- =========================================================

create or replace function public.kf_publish_question_set(p_set_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.kf_member_is_admin() then raise exception 'Admin required'; end if;
 if exists(
   select 1 from public.member_question_set_items i
   join public.member_question_bank q on q.id=i.question_id
   where i.set_id=p_set_id and q.status<>'validated'
 ) then
   raise exception 'Semua soal harus tervalidasi sebelum set diterbitkan';
 end if;
 if not exists(select 1 from public.member_question_set_items where set_id=p_set_id) then
   raise exception 'Set belum memiliki soal';
 end if;
 update public.member_question_sets
 set status=case when scheduled_at is not null and scheduled_at>now() then 'scheduled' else 'published' end,
     published_at=now(),updated_at=now()
 where id=p_set_id;
end $$;

grant execute on function public.kf_publish_question_set(uuid) to authenticated;

-- =========================================================
-- G. RIWAYAT PAKET MEMBER
-- =========================================================

create or replace function public.kf_sync_profile_package_access() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.paket is distinct from old.paket and coalesce(old.paket,'')<>'' then
   update public.member_package_access
   set status='completed',updated_at=now()
   where user_id=new.id and package_name=old.paket and status='active';
 end if;

 if coalesce(new.paket,'')<>'' then
   insert into public.member_package_access(user_id,package_name,status,started_at,expires_at,activated_by,updated_at)
   values(
     new.id,new.paket,
     case when new.status='aktif' then 'active' else 'pending' end,
     case when new.status='aktif' then now() else null end,
     new.berakhir,auth.uid(),now()
   )
   on conflict(user_id,package_name) do update
   set status=excluded.status,
       started_at=coalesce(public.member_package_access.started_at,excluded.started_at),
       expires_at=excluded.expires_at,
       activated_by=coalesce(excluded.activated_by,public.member_package_access.activated_by),
       updated_at=now();
 end if;
 return new;
end $$;

drop trigger if exists trg_kf_profile_package_access on public.member_profiles;
create trigger trg_kf_profile_package_access
after update of paket,status,berakhir on public.member_profiles
for each row execute function public.kf_sync_profile_package_access();

commit;

-- =========================================================
-- H. VERIFIKASI
-- Jika instalasi berhasil, query terakhir ini harus menghasilkan 5 baris.
-- =========================================================
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'member_package_access',
    'member_question_bank',
    'member_question_sets',
    'member_question_set_items',
    'member_set_answers'
  )
order by table_name;

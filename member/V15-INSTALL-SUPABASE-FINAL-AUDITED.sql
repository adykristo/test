-- ============================================================================
-- KLINIKFISIKAPKU V15 — INSTALLER FINAL HASIL AUDIT MEMBER AREA
-- Project baru / instalasi parsial V15. Aman dijalankan ulang.
-- Tidak menyimpan service_role key. Semua akses browser memakai RLS + RPC.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- helper updated_at ----------
create or replace function public.kf_set_updated_at() returns trigger
language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;

-- ---------- MEMBER / ADMIN ----------
create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nama text not null default '',
  username text,
  kelas text not null default '',
  wa text not null default '',
  sekolah text not null default '',
  jenjang text not null default 'sd',
  paket text not null default '',
  status text not null default 'pending',
  mulai timestamptz,
  berakhir timestamptz,
  tahap_terbuka integer not null default 0,
  catatan_admin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_profiles add column if not exists email text;
alter table public.member_profiles add column if not exists nama text not null default '';
alter table public.member_profiles add column if not exists username text;
alter table public.member_profiles add column if not exists kelas text not null default '';
alter table public.member_profiles add column if not exists wa text not null default '';
alter table public.member_profiles add column if not exists sekolah text not null default '';
alter table public.member_profiles add column if not exists jenjang text not null default 'sd';
alter table public.member_profiles add column if not exists paket text not null default '';
alter table public.member_profiles add column if not exists status text not null default 'pending';
alter table public.member_profiles add column if not exists mulai timestamptz;
alter table public.member_profiles add column if not exists berakhir timestamptz;
alter table public.member_profiles add column if not exists tahap_terbuka integer not null default 0;
alter table public.member_profiles add column if not exists catatan_admin text not null default '';
alter table public.member_profiles add column if not exists created_at timestamptz not null default now();
alter table public.member_profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists member_profiles_username_uq on public.member_profiles(lower(username)) where username is not null and username<>'';
create index if not exists member_profiles_status_idx on public.member_profiles(status);

drop trigger if exists trg_member_profiles_updated on public.member_profiles;
create trigger trg_member_profiles_updated before update on public.member_profiles for each row execute function public.kf_set_updated_at();

create table if not exists public.member_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_member_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin')
$$;
revoke all on function public.is_member_admin() from public;
grant execute on function public.is_member_admin() to authenticated;

-- ---------- PAKET MEMBER / PEMBAYARAN ----------
create table if not exists public.member_packages (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  durasi_hari integer not null default 30 check(durasi_hari>0),
  harga bigint not null default 0 check(harga>=0),
  deskripsi text not null default '',
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_member_packages_updated on public.member_packages;
create trigger trg_member_packages_updated before update on public.member_packages for each row execute function public.kf_set_updated_at();

insert into public.member_packages(nama,durasi_hari,harga,deskripsi,aktif) values
 ('Paket 1 Bulan',30,0,'Akses belajar 1 bulan',true),
 ('Paket 3 Bulan',90,0,'Akses belajar 3 bulan',true),
 ('Paket 12 Bulan',365,0,'Akses belajar 12 bulan',true),
 ('_PAYMENT_CONFIG_',1,0,'{"bank":"","nomorRekening":"","pemilikRekening":"","whatsapp":""}',true)
on conflict(nama) do nothing;

-- ---------- KONTEN MEMBER LAMA (modul/video/soal individual) ----------
create table if not exists public.member_content (
  id uuid primary key default gen_random_uuid(),
  jenjang text not null,
  jenis text not null,
  tujuan text not null default 'latihan',
  topik text not null default '',
  judul text not null,
  visible boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_content_filter_idx on public.member_content(visible,jenjang,jenis);
drop trigger if exists trg_member_content_updated on public.member_content;
create trigger trg_member_content_updated before update on public.member_content for each row execute function public.kf_set_updated_at();

create table if not exists public.member_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.member_content(id) on delete cascade,
  selesai boolean not null default false,
  skor numeric(6,2),
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(user_id,content_id)
);
create table if not exists public.member_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.member_content(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,content_id)
);
create table if not exists public.member_answer_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid references public.member_content(id) on delete cascade,
  answer jsonb,
  benar boolean,
  score numeric(6,2),
  created_at timestamptz not null default now()
);
create index if not exists member_answer_attempts_user_idx on public.member_answer_attempts(user_id,created_at desc);
create table if not exists public.member_admin_logs (
  id bigserial primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- PROFIL OTOMATIS ----------
create or replace function public.kf_username_available(p_username text) returns boolean
language sql stable security definer set search_path=public as $$
 select p_username is not null and p_username ~ '^[a-z0-9._]{4,30}$'
 and not exists(select 1 from public.member_profiles where lower(username)=lower(trim(p_username)))
$$;
grant execute on function public.kf_username_available(text) to anon,authenticated;

create or replace function public.handle_new_member() returns trigger
language plpgsql security definer set search_path=public as $$
declare u text;
begin
 u:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 if u='' or u !~ '^[a-z0-9._]{4,30}$' then u:='user_'||substr(replace(new.id::text,'-',''),1,12); end if;
 insert into public.member_profiles(id,email,nama,username,sekolah,kelas,jenjang,wa,paket,status,tahap_terbuka)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'nama',''),u,coalesce(new.raw_user_meta_data->>'sekolah',''),coalesce(new.raw_user_meta_data->>'kelas',''),lower(coalesce(new.raw_user_meta_data->>'jenjang','sd')),coalesce(new.raw_user_meta_data->>'wa',''),coalesce(new.raw_user_meta_data->>'paket',''),'pending',0)
 on conflict(id) do update set email=excluded.email;
 return new;
exception when unique_violation then
 raise exception 'Username sudah digunakan';
end $$;
drop trigger if exists on_auth_user_created_kf on auth.users;
create trigger on_auth_user_created_kf after insert on auth.users for each row execute function public.handle_new_member();

insert into public.member_profiles(id,email,nama,username)
select u.id,u.email,coalesce(u.raw_user_meta_data->>'nama',''),coalesce(nullif(lower(u.raw_user_meta_data->>'username'),''),'user_'||substr(replace(u.id::text,'-',''),1,12))
from auth.users u on conflict(id) do nothing;

-- ---------- MEMBER RPC ----------
create or replace function public.choose_member_package(p_package text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Harus login'; end if;
 if not exists(select 1 from public.member_packages where nama=p_package and aktif=true and nama <> '_PAYMENT_CONFIG_') then raise exception 'Paket tidak tersedia'; end if;
 update public.member_profiles set paket=p_package where id=auth.uid() and status<>'dihapus';
 if not found then raise exception 'Profil tidak ditemukan'; end if;
 return true;
end $$;
grant execute on function public.choose_member_package(text) to authenticated;

-- Mengembalikan konten TANPA kunci/pembahasan soal. Kunci tetap server-side.
drop function if exists public.member_secure_content();
create function public.member_secure_content()
returns table(id uuid,jenjang text,jenis text,tujuan text,topik text,judul text,visible boolean,data jsonb,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,c.jenjang,c.jenis,c.tujuan,c.topik,c.judul,c.visible,
   case when c.jenis='soal' then c.data - 'kunci' - 'pembahasan' else c.data end,
   c.created_at
 from public.member_content c join public.member_profiles p on p.id=auth.uid()
 where c.visible=true and p.status='aktif' and (p.berakhir is null or p.berakhir>now())
   and c.jenjang=p.jenjang
   and coalesce((c.data->>'learning_stage')::int,1)<=greatest(p.tahap_terbuka,1)
   and (not (c.data ? 'packages') or jsonb_typeof(c.data->'packages')<>'array' or jsonb_array_length(c.data->'packages')=0 or (c.data->'packages') ? p.paket)
 order by c.created_at desc
$$;
grant execute on function public.member_secure_content() to authenticated;

create or replace function public.kf_norm(v text) returns text language sql immutable as $$select lower(trim(regexp_replace(coalesce(v,''),'\s+',' ','g')))$$;

create or replace function public.check_member_answer(p_content_id uuid,p_answer jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.member_content; p public.member_profiles; typ text; key jsonb; ok boolean; review boolean; attempts integer; expl text; yt text;
begin
 select * into p from public.member_profiles where id=auth.uid();
 if p.id is null or p.status<>'aktif' or (p.berakhir is not null and p.berakhir<=now()) then raise exception 'Langganan tidak aktif'; end if;
 select * into c from public.member_content where id=p_content_id and visible=true and jenjang=p.jenjang;
 if c.id is null then raise exception 'Soal tidak tersedia'; end if;
 typ:=coalesce(c.data->>'tipe','pg4'); key:=c.data->'kunci'; expl:=coalesce(c.data->>'pembahasan',''); yt:=coalesce(c.data->>'youtube',''); review:=c.tujuan='tryout';
 if review then
   select count(*) into attempts from public.member_answer_attempts where user_id=auth.uid() and content_id=c.id and created_at>now()-interval '1 hour';
   if attempts>=3 then raise exception 'Batas 3 percobaan per jam tercapai'; end if;
 end if;
 if typ in ('pg4','pg5','mcma','kategori') then ok:=coalesce(p_answer,'null'::jsonb)=coalesce(key,'null'::jsonb);
 elsif typ='isian' then ok:=public.kf_norm(p_answer#>>'{}')=public.kf_norm(key#>>'{}');
 else ok:=null;
 end if;
 insert into public.member_answer_attempts(user_id,content_id,answer,benar,score) values(auth.uid(),c.id,p_answer,ok,case when ok then 100 when ok=false then 0 else null end);
 return jsonb_build_object('benar',ok,'review_locked',review,'kunci',case when review then null else key end,'pembahasan',case when review then '' else expl end,'youtube',case when review then '' else yt end);
end $$;
grant execute on function public.check_member_answer(uuid,jsonb) to authenticated;

create or replace function public.touch_member_content(p_content_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Harus login'; end if;
 if not exists(select 1 from public.member_content c join public.member_profiles p on p.id=auth.uid() where c.id=p_content_id and c.visible=true and p.status='aktif') then raise exception 'Konten tidak tersedia'; end if;
 insert into public.member_progress(user_id,content_id,last_opened_at) values(auth.uid(),p_content_id,now())
 on conflict(user_id,content_id) do update set last_opened_at=now(); return true;
end $$;
grant execute on function public.touch_member_content(uuid) to authenticated;

-- Compatibility RPC: V15 package runner dipisahkan dari daftar konten lama.
drop function if exists public.kf_member_question_content();
create function public.kf_member_question_content()
returns table(id text,jenjang text,jenis text,tujuan text,topik text,judul text,visible boolean,data jsonb,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select null::text,null::text,null::text,null::text,null::text,null::text,null::boolean,null::jsonb,null::timestamptz where false
$$;
grant execute on function public.kf_member_question_content() to authenticated;

create or replace function public.kf_check_set_answer(p_set_id text,p_question_id text,p_answer text[]) returns jsonb
language plpgsql security definer set search_path=public as $$ begin return jsonb_build_object('benar',null,'review_locked',true,'pembahasan','Gunakan paket Latihan/Tryout V15.'); end $$;
grant execute on function public.kf_check_set_answer(text,text,text[]) to authenticated;

-- ---------- ADMIN RPC ----------
create or replace function public.kf_admin_log(p_action text,p_target_type text default null,p_target_id text default null,p_detail jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin if public.is_member_admin() then insert into public.member_admin_logs(admin_id,action,target_type,target_id,detail) values(auth.uid(),p_action,p_target_type,p_target_id,p_detail); end if; end $$;

-- Nama dipertahankan agar JS admin tidak perlu ditambal.
drop function if exists public.admin_list_members_masked();
create function public.admin_list_members_masked()
returns table(id uuid,email text,nama text,username text,kelas text,wa text,sekolah text,jenjang text,paket text,status text,berakhir timestamptz,tahap_terbuka integer,catatan_admin text,created_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$ begin
 if not public.is_member_admin() then raise exception 'Akses admin ditolak'; end if;
 return query select p.id,p.email,p.nama,p.username,p.kelas,p.wa,p.sekolah,p.jenjang,p.paket,p.status,p.berakhir,p.tahap_terbuka,p.catatan_admin,p.created_at,p.updated_at from public.member_profiles p where p.status<>'dihapus' order by p.created_at desc;
end $$;
grant execute on function public.admin_list_members_masked() to authenticated;

create or replace function public.admin_update_member(p_id uuid,p_action text,p_package text default '',p_note text default '') returns boolean
language plpgsql security definer set search_path=public as $$
declare d integer; pkg text;
begin
 if not public.is_member_admin() then raise exception 'Akses admin ditolak'; end if;
 if p_action='activate' then
   pkg:=coalesce(nullif(trim(p_package),''),(select paket from public.member_profiles where id=p_id));
   select durasi_hari into d from public.member_packages where nama=pkg and aktif=true;
   if d is null then raise exception 'Paket member tidak ditemukan/aktif'; end if;
   update public.member_profiles set paket=pkg,status='aktif',mulai=now(),berakhir=now()+make_interval(days=>d),tahap_terbuka=greatest(tahap_terbuka,1),catatan_admin=p_note where id=p_id;
 elsif p_action='reject' then update public.member_profiles set status='ditolak',catatan_admin=p_note where id=p_id;
 elsif p_action='deactivate' then update public.member_profiles set status='nonaktif',catatan_admin=coalesce(nullif(p_note,''),catatan_admin) where id=p_id;
 elsif p_action='reactivate' then update public.member_profiles set status='aktif',berakhir=case when berakhir is null or berakhir<=now() then now()+interval '30 days' else berakhir end,catatan_admin=coalesce(nullif(p_note,''),catatan_admin) where id=p_id;
 elsif p_action='soft_delete' then update public.member_profiles set status='dihapus',catatan_admin=coalesce(nullif(p_note,''),'Dihapus admin') where id=p_id;
 else raise exception 'Aksi admin tidak dikenal'; end if;
 perform public.kf_admin_log('member_'||p_action,'member',p_id::text,jsonb_build_object('package',p_package,'note',p_note)); return true;
end $$;
grant execute on function public.admin_update_member(uuid,text,text,text) to authenticated;

create or replace function public.admin_set_member_tahap(p_id uuid,p_tahap integer) returns boolean
language plpgsql security definer set search_path=public as $$ begin if not public.is_member_admin() then raise exception 'Akses admin ditolak'; end if; if p_tahap<0 or p_tahap>12 then raise exception 'Tahap 0-12'; end if; update public.member_profiles set tahap_terbuka=p_tahap where id=p_id; perform public.kf_admin_log('set_tahap','member',p_id::text,jsonb_build_object('tahap',p_tahap)); return true; end $$;
grant execute on function public.admin_set_member_tahap(uuid,integer) to authenticated;

-- ---------- V15 PAKET FINAL ----------
create table if not exists public.kf_packages (
 id uuid primary key default gen_random_uuid(), external_id text unique, kind text not null check(kind in('latihan','tryout')), name text not null,
 jenjang text, kelas text, mapel text default 'Fisika', subscription text default 'Semua Paket Aktif', duration_minutes integer not null default 0 check(duration_minutes>=0),
 starts_at timestamptz, ends_at timestamptz, max_attempts integer not null default 1 check(max_attempts>=1), visible boolean not null default false,
 source text default 'V12', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.kf_questions (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.kf_packages(id) on delete cascade, external_id text, position integer not null,
 type text not null default 'pg4', topic text, question text not null default '', image text, options jsonb not null default '[]'::jsonb, answer_key jsonb,
 statements jsonb not null default '[]'::jsonb, category_labels jsonb not null default '[]'::jsonb, explanation text, scoring text default 'exact', source_v12_package text, source_v12_question text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(package_id,position)
);
create table if not exists public.kf_attempts (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.kf_packages(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
 attempt_no integer not null, started_at timestamptz not null default now(), deadline_at timestamptz, submitted_at timestamptz,
 status text not null default 'in_progress' check(status in('in_progress','submitted','expired')), objective_score numeric(6,2), essay_count integer not null default 0, auto_submitted boolean not null default false,
 unique(package_id,user_id,attempt_no)
);
create table if not exists public.kf_answers (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.kf_attempts(id) on delete cascade, question_id uuid not null references public.kf_questions(id) on delete cascade,
 answer jsonb, auto_score numeric(8,4), needs_review boolean not null default false, saved_at timestamptz not null default now(), unique(attempt_id,question_id)
);
create index if not exists kf_questions_package_idx on public.kf_questions(package_id,position);
create index if not exists kf_attempts_user_idx on public.kf_attempts(user_id,package_id);
create index if not exists kf_packages_visible_idx on public.kf_packages(visible,kind);

drop trigger if exists trg_kf_packages_updated on public.kf_packages; create trigger trg_kf_packages_updated before update on public.kf_packages for each row execute function public.kf_set_updated_at();
drop trigger if exists trg_kf_questions_updated on public.kf_questions; create trigger trg_kf_questions_updated before update on public.kf_questions for each row execute function public.kf_set_updated_at();

create or replace function public.kf_subscription_match(required text,owned text) returns boolean language plpgsql immutable as $$declare r text; o text; begin r:=lower(trim(coalesce(required,'')));o:=lower(trim(coalesce(owned,'')));if r='' or r in('semua','all','semua paket aktif') then return true;end if;return o=any(string_to_array(replace(r,' | ','|'),'|'));end$$;

create or replace function public.kf_list_available_packages()
returns table(id uuid,kind text,name text,jenjang text,kelas text,mapel text,duration_minutes integer,starts_at timestamptz,ends_at timestamptz,max_attempts integer,question_count bigint,attempts_used bigint)
language sql stable security definer set search_path=public as $$
 select p.id,p.kind,p.name,p.jenjang,p.kelas,p.mapel,p.duration_minutes,p.starts_at,p.ends_at,p.max_attempts,
 (select count(*) from public.kf_questions q where q.package_id=p.id),(select count(*) from public.kf_attempts a where a.package_id=p.id and a.user_id=auth.uid())
 from public.kf_packages p join public.member_profiles m on m.id=auth.uid()
 where p.visible=true and m.status='aktif' and (m.berakhir is null or m.berakhir>now()) and public.kf_subscription_match(p.subscription,m.paket)
 and (p.jenjang is null or p.jenjang='' or lower(p.jenjang)=lower(m.jenjang)) order by p.created_at desc
$$;
grant execute on function public.kf_list_available_packages() to authenticated;

create or replace function public.kf_start_attempt(p_package uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.kf_packages;m public.member_profiles;used integer;aid uuid;no integer;dl timestamptz;
begin
 select * into p from public.kf_packages where id=p_package and visible=true;if p.id is null then raise exception 'Paket tidak tersedia';end if;
 select * into m from public.member_profiles where id=auth.uid();if m.id is null or m.status<>'aktif' or (m.berakhir is not null and m.berakhir<=now()) then raise exception 'Langganan tidak aktif';end if;
 if not public.kf_subscription_match(p.subscription,m.paket) then raise exception 'Paket tidak termasuk langganan Anda';end if;
 if p.jenjang is not null and p.jenjang<>'' and lower(p.jenjang)<>lower(m.jenjang) then raise exception 'Jenjang paket tidak sesuai';end if;
 if p.starts_at is not null and now()<p.starts_at then raise exception 'Paket belum dimulai';end if;if p.ends_at is not null and now()>p.ends_at then raise exception 'Paket sudah berakhir';end if;
 select count(*) into used from public.kf_attempts where package_id=p.id and user_id=auth.uid();if p.kind='tryout' and used>=p.max_attempts then raise exception 'Batas percobaan sudah habis';end if;
 no:=used+1;dl:=case when p.kind='tryout' and p.duration_minutes>0 then least(now()+make_interval(mins=>p.duration_minutes),coalesce(p.ends_at,'infinity'::timestamptz)) else null end;
 insert into public.kf_attempts(package_id,user_id,attempt_no,deadline_at) values(p.id,auth.uid(),no,dl) returning id into aid;
 return jsonb_build_object('attempt_id',aid,'attempt_no',no,'deadline_at',dl);
end$$;
grant execute on function public.kf_start_attempt(uuid) to authenticated;

-- PENTING: tidak mengirim answer_key, explanation, atau key di statements.
drop function if exists public.kf_attempt_questions(uuid);
create function public.kf_attempt_questions(p_attempt uuid)
returns table(question_id uuid,question_position integer,question_type text,topic text,question text,image text,options jsonb,statements jsonb,category_labels jsonb)
language sql stable security definer set search_path=public as $$
 select q.id,q.position,q.type,q.topic,q.question,q.image,q.options,
   coalesce((select jsonb_agg(jsonb_build_object('text',e.value->>'text') order by e.ordinality) from jsonb_array_elements(q.statements) with ordinality e(value,ordinality)),'[]'::jsonb),q.category_labels
 from public.kf_questions q join public.kf_attempts a on a.package_id=q.package_id
 where a.id=p_attempt and a.user_id=auth.uid() and a.status='in_progress' and (a.deadline_at is null or now()<=a.deadline_at)
 order by q.position
$$;
grant execute on function public.kf_attempt_questions(uuid) to authenticated;

create or replace function public.kf_save_answer(p_attempt uuid,p_question uuid,p_answer jsonb) returns boolean
language plpgsql security definer set search_path=public as $$declare a public.kf_attempts;begin select * into a from public.kf_attempts where id=p_attempt and user_id=auth.uid();if a.id is null or a.status<>'in_progress' then raise exception 'Attempt tidak aktif';end if;if a.deadline_at is not null and now()>a.deadline_at then update public.kf_attempts set status='expired' where id=a.id;raise exception 'Waktu sudah habis';end if;if not exists(select 1 from public.kf_questions where id=p_question and package_id=a.package_id) then raise exception 'Soal tidak valid';end if;insert into public.kf_answers(attempt_id,question_id,answer) values(p_attempt,p_question,p_answer) on conflict(attempt_id,question_id) do update set answer=excluded.answer,saved_at=now();return true;end$$;
grant execute on function public.kf_save_answer(uuid,uuid,jsonb) to authenticated;

create or replace function public.kf_submit_attempt(p_attempt uuid,p_auto boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.kf_attempts;q record;ans jsonb;earned numeric:=0;total integer:=0;essays integer:=0;s numeric:=0;i integer;expected text;chosen integer;label text;
begin
 select * into a from public.kf_attempts where id=p_attempt and user_id=auth.uid() for update;if a.id is null then raise exception 'Attempt tidak ditemukan';end if;if a.status<>'in_progress' then return jsonb_build_object('score',a.objective_score,'essay_count',a.essay_count,'already_submitted',true);end if;
 for q in select * from public.kf_questions where package_id=a.package_id order by position loop
   select answer into ans from public.kf_answers where attempt_id=a.id and question_id=q.id;s:=0;
   if q.type in('pg4','pg5','mcma') then total:=total+1;if coalesce(ans,'null'::jsonb)=coalesce(q.answer_key,'null'::jsonb) then s:=1;end if;
   elsif q.type='isian' then total:=total+1;if public.kf_norm(ans#>>'{}')=public.kf_norm(q.answer_key#>>'{}') then s:=1;end if;
   elsif q.type='kategori' then total:=total+1;s:=0;if jsonb_array_length(coalesce(q.answer_key,'[]'::jsonb))>0 then
      for i in 0..jsonb_array_length(q.answer_key)-1 loop expected:=q.answer_key->>i;begin chosen:=(ans->>i)::integer;exception when others then chosen:=-999;end;label:=q.category_labels->>chosen;if public.kf_norm(label)=public.kf_norm(expected) then s:=s+1;end if;end loop;s:=s/jsonb_array_length(q.answer_key);
   end if;
   else essays:=essays+1;end if;earned:=earned+s;
   insert into public.kf_answers(attempt_id,question_id,answer,auto_score,needs_review) values(a.id,q.id,ans,s,q.type='esai') on conflict(attempt_id,question_id) do update set auto_score=excluded.auto_score,needs_review=excluded.needs_review;
 end loop;
 update public.kf_attempts set status='submitted',submitted_at=now(),objective_score=case when total>0 then round(earned*100/total,2) else 0 end,essay_count=essays,auto_submitted=p_auto where id=a.id;
 return jsonb_build_object('score',case when total>0 then round(earned*100/total,2) else 0 end,'essay_count',essays,'auto_submitted',p_auto);
end$$;
grant execute on function public.kf_submit_attempt(uuid,boolean) to authenticated;

drop function if exists public.kf_my_results();
create function public.kf_my_results()
returns table(attempt_id uuid,package_id uuid,package_name text,kind text,attempt_no integer,score numeric,essay_count integer,submitted_at timestamptz)
language sql stable security definer set search_path=public as $$select a.id,p.id,p.name,p.kind,a.attempt_no,a.objective_score,a.essay_count,a.submitted_at from public.kf_attempts a join public.kf_packages p on p.id=a.package_id where a.user_id=auth.uid() and a.status='submitted' order by a.submitted_at desc$$;
grant execute on function public.kf_my_results() to authenticated;

-- ---------- RLS ----------
alter table public.member_profiles enable row level security;alter table public.member_admins enable row level security;alter table public.member_packages enable row level security;alter table public.member_content enable row level security;alter table public.member_progress enable row level security;alter table public.member_bookmarks enable row level security;alter table public.member_answer_attempts enable row level security;alter table public.member_admin_logs enable row level security;alter table public.kf_packages enable row level security;alter table public.kf_questions enable row level security;alter table public.kf_attempts enable row level security;alter table public.kf_answers enable row level security;

-- bersihkan policy bernama versi final agar rerun aman
drop policy if exists kf_profile_self_select on public.member_profiles;create policy kf_profile_self_select on public.member_profiles for select to authenticated using(id=auth.uid() or public.is_member_admin());
drop policy if exists kf_admins_self_select on public.member_admins;create policy kf_admins_self_select on public.member_admins for select to authenticated using(user_id=auth.uid());
drop policy if exists kf_packages_public_read on public.member_packages;create policy kf_packages_public_read on public.member_packages for select to anon,authenticated using(aktif=true);
drop policy if exists kf_packages_admin_all on public.member_packages;create policy kf_packages_admin_all on public.member_packages for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());
drop policy if exists kf_content_admin_all on public.member_content;create policy kf_content_admin_all on public.member_content for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());
drop policy if exists kf_progress_self on public.member_progress;create policy kf_progress_self on public.member_progress for select to authenticated using(user_id=auth.uid());
drop policy if exists kf_bookmark_self_all on public.member_bookmarks;create policy kf_bookmark_self_all on public.member_bookmarks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists kf_attemptlegacy_self_select on public.member_answer_attempts;create policy kf_attemptlegacy_self_select on public.member_answer_attempts for select to authenticated using(user_id=auth.uid());
drop policy if exists kf_admin_logs_admin_select on public.member_admin_logs;create policy kf_admin_logs_admin_select on public.member_admin_logs for select to authenticated using(public.is_member_admin());
drop policy if exists kf_final_packages_admin_all on public.kf_packages;create policy kf_final_packages_admin_all on public.kf_packages for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());
drop policy if exists kf_final_questions_admin_all on public.kf_questions;create policy kf_final_questions_admin_all on public.kf_questions for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());
drop policy if exists kf_attempts_self_select on public.kf_attempts;create policy kf_attempts_self_select on public.kf_attempts for select to authenticated using(user_id=auth.uid() or public.is_member_admin());
drop policy if exists kf_answers_self_select on public.kf_answers;create policy kf_answers_self_select on public.kf_answers for select to authenticated using(public.is_member_admin() or exists(select 1 from public.kf_attempts a where a.id=attempt_id and a.user_id=auth.uid()));

-- privileges: tabel sensitif tidak dibuka untuk anon. RPC menangani operasi peserta.
grant select on public.member_packages to anon,authenticated;
grant select on public.member_profiles,public.member_admins,public.member_progress,public.member_bookmarks,public.member_answer_attempts to authenticated;
grant insert,delete on public.member_bookmarks to authenticated;
grant select,insert,update,delete on public.member_packages,public.member_content,public.member_admin_logs,public.kf_packages,public.kf_questions to authenticated;
grant select on public.kf_attempts,public.kf_answers to authenticated;

-- ---------- VERIFIKASI OBJEK ----------
select 'TABLE' as tipe,x as objek,to_regclass('public.'||x) is not null as ok from unnest(array['member_profiles','member_admins','member_packages','member_content','member_progress','member_bookmarks','member_answer_attempts','member_admin_logs','kf_packages','kf_questions','kf_attempts','kf_answers']) x
union all
select 'FUNCTION',x,to_regprocedure('public.'||x) is not null from unnest(array['is_member_admin()','kf_username_available(text)','choose_member_package(text)','member_secure_content()','check_member_answer(uuid,jsonb)','touch_member_content(uuid)','admin_list_members_masked()','admin_update_member(uuid,text,text,text)','admin_set_member_tahap(uuid,integer)','kf_list_available_packages()','kf_start_attempt(uuid)','kf_attempt_questions(uuid)','kf_save_answer(uuid,uuid,jsonb)','kf_submit_attempt(uuid,boolean)','kf_my_results()']) x
order by tipe,objek;

-- KlinikFisikapku FINAL-INTEGRATED
-- Jalankan SETELAH supabase-setup-final.sql dan MIGRASI-PLATFORM-PELATIHAN-12-BULAN.sql.

alter table public.member_question_sets add column if not exists explanation_release_at timestamptz;
alter table public.member_question_sets add column if not exists instructions text default '';
alter table public.member_question_sets add column if not exists max_attempts int default 1;
alter table public.member_question_sets add column if not exists passing_score numeric default 0;
alter table public.member_question_sets add column if not exists published_at timestamptz;
alter table public.member_question_bank add column if not exists explanation_image_url text default '';
alter table public.member_question_bank add column if not exists option_images jsonb not null default '[]'::jsonb;
alter table public.member_question_bank add column if not exists validation_notes text default '';

create table if not exists public.member_question_versions(
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.member_question_bank(id) on delete cascade,
 version int not null, snapshot jsonb not null, created_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(question_id,version)
);
create table if not exists public.member_set_answers(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 set_id uuid not null references public.member_question_sets(id) on delete cascade,
 question_id uuid not null references public.member_question_bank(id) on delete restrict,
 answer jsonb, correct boolean, score numeric default 0, created_at timestamptz not null default now()
);
create index if not exists idx_set_answers_user on public.member_set_answers(user_id,set_id,created_at desc);

alter table public.member_question_versions enable row level security;
alter table public.member_set_answers enable row level security;
drop policy if exists "admin manage question versions" on public.member_question_versions;
create policy "admin manage question versions" on public.member_question_versions for all using(public.kf_member_is_admin()) with check(public.kf_member_is_admin());
drop policy if exists "member read own set answers" on public.member_set_answers;
create policy "member read own set answers" on public.member_set_answers for select using(auth.uid()=user_id);
drop policy if exists "admin manage set answers" on public.member_set_answers;
create policy "admin manage set answers" on public.member_set_answers for all using(public.kf_member_is_admin()) with check(public.kf_member_is_admin());

-- Simpan versi lama otomatis sebelum soal diedit.
create or replace function public.kf_question_version_before_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if row_to_json(old)::jsonb is distinct from row_to_json(new)::jsonb then
   insert into public.member_question_versions(question_id,version,snapshot,created_by)
   values(old.id,old.version,to_jsonb(old),auth.uid()) on conflict do nothing;
   new.version:=old.version+1; new.updated_by:=auth.uid(); new.updated_at:=now();
 end if; return new;
end $$;
drop trigger if exists trg_kf_question_version on public.member_question_bank;
create trigger trg_kf_question_version before update on public.member_question_bank for each row execute function public.kf_question_version_before_update();

-- Set terbit yang boleh dilihat peserta aktif. Kunci/pembahasan tidak pernah dikirim oleh fungsi ini.
create or replace function public.kf_member_question_content() returns setof jsonb
language sql volatile security definer set search_path=public as $$
with me as (
 select p.id,p.jenjang,p.paket,p.status,p.berakhir from member_profiles p where p.id=auth.uid()
), allowed as (
 select s.* from member_question_sets s, me
 where me.status='aktif' and (me.berakhir is null or me.berakhir>now())
 and s.jenjang=me.jenjang and s.status in ('published','scheduled')
 and (s.scheduled_at is null or s.scheduled_at<=now())
 and (coalesce(s.package_name,'')='' or s.package_name=me.paket or exists(
   select 1 from member_package_access a where a.user_id=me.id and a.package_name=s.package_name and a.status='active' and (a.expires_at is null or a.expires_at>now())
 ))
)
select jsonb_build_object(
 'id','qset:'||s.id::text||':'||q.id::text,'source_type','question_set','set_id',s.id,'question_id',q.id,
 'jenis','soal','tujuan',case when s.set_type='tryout' then 'tryout' else 'latihan' end,
 'topik',s.name,'judul',coalesce(q.subtopik,q.topik),'jenjang',s.jenjang,'tipe',q.question_type,
 'soal',q.stem,'opsi',q.options,'gambar',q.image_url,'visible',true,'scheduled_at',s.scheduled_at,
 'duration_minutes',s.duration_minutes,'learning_stage',coalesce((select mp.bulan from member_packages mp where mp.nama=s.package_name limit 1),1)
) from allowed s join member_question_set_items i on i.set_id=s.id join member_question_bank q on q.id=i.question_id
where q.status='validated' order by s.scheduled_at nulls first,case when s.randomize_questions then random() else i.position::double precision end;
$$;
grant execute on function public.kf_member_question_content() to authenticated;

create or replace function public.kf_check_set_answer(p_set_id uuid,p_question_id uuid,p_answer jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s member_question_sets; q member_question_bank; ok boolean:=false; release boolean:=true; ans jsonb; expected jsonb;
begin
 select * into s from member_question_sets where id=p_set_id;
 if s.id is null then raise exception 'Set soal tidak ditemukan'; end if;
 if not exists(select 1 from public.kf_member_question_content() as x(item) where item->>'set_id'=p_set_id::text and item->>'question_id'=p_question_id::text) then raise exception 'Soal belum dapat diakses'; end if;
 select * into q from member_question_bank where id=p_question_id; expected:=q.answer; ans:=p_answer;
 if q.question_type in ('pg4','pg5','pgk','mcma') then ok:=lower(expected::text)=lower(ans::text); else ok:=lower(trim(both '"' from expected::text))=lower(trim(both '"' from ans::text)); end if;
 insert into member_set_answers(user_id,set_id,question_id,answer,correct,score) values(auth.uid(),p_set_id,p_question_id,ans,ok,case when ok then 100 else 0 end);
 release:=s.set_type='daily' or (s.explanation_release_at is not null and now()>=s.explanation_release_at);
 return jsonb_build_object('benar',ok,'review_locked',not release,'kunci',case when release then q.answer else null end,'pembahasan',case when release then q.explanation else null end,'explanation_image_url',case when release then q.explanation_image_url else null end);
end $$;
grant execute on function public.kf_check_set_answer(uuid,uuid,jsonb) to authenticated;

-- Admin helper untuk publikasi set.
create or replace function public.kf_publish_question_set(p_set_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.kf_member_is_admin() then raise exception 'Admin required'; end if;
 if exists(select 1 from member_question_set_items i join member_question_bank q on q.id=i.question_id where i.set_id=p_set_id and q.status<>'validated') then raise exception 'Semua soal harus tervalidasi sebelum set diterbitkan'; end if;
 if not exists(select 1 from member_question_set_items where set_id=p_set_id) then raise exception 'Set belum memiliki soal'; end if;
 update member_question_sets set status=case when scheduled_at>now() then 'scheduled' else 'published' end,published_at=now(),updated_at=now() where id=p_set_id;
end $$;
grant execute on function public.kf_publish_question_set(uuid) to authenticated;

-- Menjaga riwayat paket walau Admin lama masih mengaktifkan melalui member_profiles.
create or replace function public.kf_sync_profile_package_access() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.paket is distinct from old.paket and coalesce(old.paket,'')<>'' then
   update member_package_access set status='completed',updated_at=now() where user_id=new.id and package_name=old.paket and status='active';
 end if;
 if coalesce(new.paket,'')<>'' then
   insert into member_package_access(user_id,package_name,status,started_at,expires_at,activated_by,updated_at)
   values(new.id,new.paket,case when new.status='aktif' then 'active' else 'pending' end,case when new.status='aktif' then now() else null end,new.berakhir,auth.uid(),now())
   on conflict(user_id,package_name) do update set status=excluded.status,started_at=coalesce(member_package_access.started_at,excluded.started_at),expires_at=excluded.expires_at,activated_by=coalesce(excluded.activated_by,member_package_access.activated_by),updated_at=now();
 end if; return new;
end $$;
drop trigger if exists trg_kf_profile_package_access on public.member_profiles;
create trigger trg_kf_profile_package_access after update of paket,status,berakhir on public.member_profiles for each row execute function public.kf_sync_profile_package_access();

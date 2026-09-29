-- KLINIKFISIKAPKU - MIGRASI TAHAP BELAJAR 12 BULAN
-- Jalankan sekali setelah supabase-setup.sql berhasil.

alter table public.member_profiles
  add column if not exists tahap_terbuka integer not null default 0;

alter table public.member_profiles drop constraint if exists member_profiles_tahap_terbuka_check;
alter table public.member_profiles add constraint member_profiles_tahap_terbuka_check
  check (tahap_terbuka between 0 and 12);

-- Member lama yang sudah aktif minimal tetap mendapat Tahap 1.
update public.member_profiles
set tahap_terbuka=1
where status='aktif' and tahap_terbuka=0;

create or replace function public.validate_learning_stage()
returns trigger language plpgsql set search_path='' as $$
declare v_stage integer;
begin
  v_stage:=coalesce((new.data->>'learning_stage')::integer,1);
  if v_stage<1 or v_stage>12 then raise exception 'Tahap belajar harus 1 sampai 12'; end if;
  new.data:=jsonb_set(new.data,'{learning_stage}',to_jsonb(v_stage),true);
  return new;
exception when invalid_text_representation then
  raise exception 'Tahap belajar harus berupa angka 1 sampai 12';
end; $$;

drop trigger if exists validate_learning_stage_trigger on public.member_content;
create trigger validate_learning_stage_trigger
before insert or update on public.member_content
for each row execute function public.validate_learning_stage();

update public.member_content
set data=jsonb_set(data,'{learning_stage}','1'::jsonb,true)
where not (data ? 'learning_stage');

create or replace function public.member_can_access_content(p_content_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.member_content c
    join public.member_profiles p on p.id=auth.uid()
    where c.id=p_content_id
      and p.status='aktif' and (p.berakhir is null or p.berakhir>now())
      and c.visible=true and c.jenjang=p.jenjang
      and coalesce((c.data->>'learning_stage')::integer,1)<=p.tahap_terbuka
      and (
        not (c.data ? 'packages')
        or jsonb_typeof(c.data->'packages')<>'array'
        or jsonb_array_length(c.data->'packages')=0
        or c.data->'packages' ? coalesce(p.paket,'')
      )
  );
$$;

create or replace function public.member_secure_content()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if public.member_active_grade() is null then raise exception 'Akses member tidak aktif'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'jenjang',c.jenjang,'jenis',c.jenis,'tujuan',c.tujuan,
    'topik',c.topik,'judul',c.judul,'visible',c.visible,'created_at',c.created_at,
    'data',case when c.jenis='soal' then
      (c.data-'kunci'-'pembahasan'-'youtube'-'rubrik') ||
      case when jsonb_typeof(c.data->'statements')='array' then jsonb_build_object(
        'statements',coalesce((select jsonb_agg(jsonb_build_object('text',s.value->>'text') order by s.ord)
          from jsonb_array_elements(c.data->'statements') with ordinality s(value,ord)),'[]'::jsonb)
      ) else '{}'::jsonb end
    else (c.data-'youtube'-'source_private') end
  ) order by coalesce((c.data->>'learning_stage')::integer,1),c.created_at),'[]'::jsonb)
  into v_result
  from public.member_content c
  where public.member_can_access_content(c.id);
  return v_result;
end; $$;

create or replace function public.touch_member_content(p_content_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.member_can_access_content(p_content_id) then raise exception 'Konten belum terbuka'; end if;
  insert into public.member_progress(user_id,content_id,last_opened_at)
  values(auth.uid(),p_content_id,now())
  on conflict(user_id,content_id) do update
    set last_opened_at=now(),updated_at=now();
end; $$;

create or replace function public.check_member_answer(p_content_id uuid,p_answer jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_content public.member_content; v_type text; v_correct boolean;
  v_given text; v_key text; v_given_arr text[]; v_key_arr text[];
  v_attempt_count integer; v_reveal boolean;
begin
  if not public.member_can_access_content(p_content_id) then raise exception 'Soal belum terbuka'; end if;
  select * into v_content from public.member_content where id=p_content_id and jenis='soal';
  if not found then raise exception 'Soal tidak ditemukan'; end if;
  select count(*) into v_attempt_count from public.member_answer_attempts
    where user_id=auth.uid() and content_id=p_content_id and created_at>now()-interval '1 hour';
  if v_attempt_count >= (case when v_content.tujuan='tryout' then 3 else 30 end) then
    raise exception 'Batas percobaan tercapai. Coba lagi satu jam lagi.';
  end if;
  if pg_column_size(coalesce(p_answer,'null'::jsonb))>10000 then raise exception 'Jawaban terlalu besar'; end if;
  v_type:=coalesce(v_content.data->>'tipe','pg4');
  if v_type in ('pg4','pg5') then
    v_given:=trim(coalesce(p_answer#>>'{}',''));v_key:=trim(coalesce(v_content.data->>'kunci',''));
    v_correct:=v_given~'^[0-9]+$' and v_key~'^[0-9]+$' and v_given::int=v_key::int;
  elsif v_type='mcma' then
    select array_agg(value order by value) into v_given_arr from jsonb_array_elements_text(coalesce(p_answer,'[]'::jsonb));
    select array_agg(value order by value) into v_key_arr from jsonb_array_elements_text(coalesce(v_content.data->'kunci','[]'::jsonb));
    v_correct:=coalesce(v_given_arr,'{}')=coalesce(v_key_arr,'{}');
  elsif v_type='kategori' then
    select array_agg(lower(trim(value)) order by ord) into v_given_arr from jsonb_array_elements_text(coalesce(p_answer,'[]'::jsonb)) with ordinality a(value,ord);
    select array_agg(lower(trim(value->>'key')) order by ord) into v_key_arr from jsonb_array_elements(coalesce(v_content.data->'statements','[]'::jsonb)) with ordinality a(value,ord);
    v_correct:=coalesce(v_given_arr,'{}')=coalesce(v_key_arr,'{}') and cardinality(coalesce(v_key_arr,'{}'))>0;
  elsif v_type='isian' then
    v_correct:=lower(trim(coalesce(p_answer#>>'{}','')))=lower(trim(coalesce(v_content.data->>'kunci','')));
  else v_correct:=null;
  end if;
  insert into public.member_answer_attempts(user_id,content_id,benar) values(auth.uid(),p_content_id,v_correct);
  if v_correct is true then
    insert into public.member_progress(user_id,content_id,selesai,skor,jawaban,last_opened_at,completed_at)
    values(auth.uid(),p_content_id,true,100,jsonb_build_object('jawaban',p_answer),now(),now())
    on conflict(user_id,content_id) do update set selesai=true,skor=100,jawaban=excluded.jawaban,last_opened_at=now(),completed_at=coalesce(public.member_progress.completed_at,now()),updated_at=now();
  end if;
  v_reveal:=coalesce(v_content.tujuan,'latihan')<>'tryout' or v_correct is true or v_attempt_count>=2;
  return jsonb_build_object('benar',v_correct,
    'kunci',case when v_reveal then v_content.data->'kunci' else null end,
    'pembahasan',case when v_reveal then coalesce(v_content.data->>'pembahasan','') else '' end,
    'youtube',case when v_reveal then coalesce(v_content.data->>'youtube','') else '' end,
    'review_locked',not v_reveal);
end; $$;

create or replace function public.admin_list_members_masked()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not public.is_member_super_admin() then raise exception 'Hanya Admin Utama'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'email',case when position('@' in p.email)>1 then left(p.email,3)||'***@'||split_part(p.email,'@',2) else '***' end,
    'nama',p.nama,'username',p.username,'kelas',p.kelas,
    'wa',case when length(regexp_replace(p.wa,'[^0-9]','','g'))>7 then left(regexp_replace(p.wa,'[^0-9]','','g'),4)||'****'||right(regexp_replace(p.wa,'[^0-9]','','g'),4) else '****' end,
    'sekolah',p.sekolah,'jenjang',p.jenjang,'paket',p.paket,'status',p.status,
    'tahap_terbuka',p.tahap_terbuka,'berakhir',p.berakhir,'catatan_admin',p.catatan_admin,
    'created_at',p.created_at,'updated_at',p.updated_at
  ) order by p.created_at desc),'[]'::jsonb) into v_result
  from public.member_profiles p where p.status<>'dihapus'
    and not exists(select 1 from public.member_admins a where a.user_id=p.id);
  return v_result;
end; $$;

create or replace function public.admin_update_member(p_id uuid,p_action text,p_package text default '',p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_profile public.member_profiles;v_days int;v_base timestamptz;v_increment int;
begin
  if not public.is_member_super_admin() then raise exception 'Hanya Admin Utama'; end if;
  if p_action not in ('activate','renew','reject','reactivate','deactivate','soft_delete') then raise exception 'Aksi tidak valid'; end if;
  select * into v_profile from public.member_profiles where id=p_id for update;
  if not found then raise exception 'Member tidak ditemukan'; end if;
  if p_action in ('activate','renew') then
    select durasi_hari into v_days from public.member_packages where nama=trim(p_package) and aktif=true;
    if v_days is null then raise exception 'Paket tidak valid'; end if;
    v_base:=case when v_profile.status='aktif' and v_profile.berakhir>now() then v_profile.berakhir else now() end;
    v_increment:=greatest(1,least(12,ceil(v_days::numeric/30)::integer));
    update public.member_profiles set status='aktif',paket=trim(p_package),
      berakhir=v_base+make_interval(days=>v_days),
      tahap_terbuka=least(12,greatest(0,v_profile.tahap_terbuka)+v_increment),
      catatan_admin=left(trim(coalesce(p_note,'')),1000) where id=p_id;
  elsif p_action='reactivate' then
    select durasi_hari into v_days from public.member_packages where nama=v_profile.paket;
    update public.member_profiles set status='aktif',berakhir=case when v_profile.berakhir>now() then v_profile.berakhir else now()+make_interval(days=>coalesce(v_days,30)) end where id=p_id;
  elsif p_action='reject' then update public.member_profiles set status='ditolak',catatan_admin=left(trim(coalesce(p_note,'')),1000) where id=p_id;
  elsif p_action='deactivate' then update public.member_profiles set status='nonaktif',catatan_admin=left(trim(coalesce(p_note,'')),1000) where id=p_id;
  else update public.member_profiles set status='dihapus',catatan_admin=left(trim(coalesce(p_note,'')),1000) where id=p_id;
  end if;
  insert into public.member_admin_logs(admin_id,aksi,target_type,target_id,detail)
  values(auth.uid(),'member_'||p_action,'member',p_id::text,jsonb_build_object('paket',p_package,'status_sebelum',v_profile.status,'tahap_sebelum',v_profile.tahap_terbuka));
end; $$;

revoke select on public.member_profiles from authenticated;
grant select(id,email,nama,username,kelas,wa,sekolah,jenjang,paket,status,berakhir,tahap_terbuka,created_at,updated_at) on public.member_profiles to authenticated;
revoke all on function public.member_can_access_content(uuid) from public,anon;
grant execute on function public.member_can_access_content(uuid) to authenticated;
grant execute on function public.member_secure_content() to authenticated;
grant execute on function public.touch_member_content(uuid) to authenticated;
grant execute on function public.check_member_answer(uuid,jsonb) to authenticated;
grant execute on function public.admin_update_member(uuid,text,text,text) to authenticated;

-- ============================================================
-- Tambahan: Admin set tahap_terbuka secara manual
-- ============================================================
create or replace function public.admin_set_member_tahap(p_id uuid, p_tahap integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_member_super_admin() then raise exception 'Hanya Admin Utama'; end if;
  if p_tahap is null or p_tahap < 0 or p_tahap > 12 then raise exception 'Tahap harus 0 sampai 12'; end if;
  update public.member_profiles set tahap_terbuka = p_tahap, updated_at = now() where id = p_id;
  if not found then raise exception 'Member tidak ditemukan'; end if;
  insert into public.member_admin_logs(admin_id,aksi,target_type,target_id,detail)
  values(auth.uid(),'member_set_tahap','member',p_id::text,jsonb_build_object('tahap',p_tahap));
end; $$;

grant execute on function public.admin_set_member_tahap(uuid,integer) to authenticated;

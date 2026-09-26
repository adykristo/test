-- MIGRASI PENDAFTARAN MEMBER KLINIKFISIKAPKU
-- Jalankan sekali di Supabase > SQL Editor untuk database yang SUDAH terpasang.

alter table public.member_profiles add column if not exists username text not null default '';
alter table public.member_profiles add column if not exists kelas text not null default '';

create unique index if not exists member_profiles_username_unique
  on public.member_profiles(lower(username)) where username <> '';

create or replace function public.handle_new_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_jenjang text; v_username text; v_kelas text;
begin
  if lower(coalesce(new.email,'')) !~ '^[^@]+@gmail\.com$' then
    raise exception 'Gunakan email Google (@gmail.com)';
  end if;
  v_jenjang := lower(coalesce(new.raw_user_meta_data->>'jenjang',''));
  if v_jenjang not in ('sd','smp','sma') then raise exception 'Jenjang tidak valid'; end if;
  v_username := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  v_kelas := trim(coalesce(new.raw_user_meta_data->>'kelas',''));
  if v_username !~ '^[a-z0-9._]{4,30}$' then raise exception 'Username tidak valid'; end if;
  if v_kelas !~ '^(1|2|3|4|5|6|7|8|9|10|11|12)$' then raise exception 'Kelas tidak valid'; end if;

  insert into public.member_profiles(id,email,nama,username,kelas,wa,sekolah,jenjang,paket)
  values(
    new.id,left(coalesce(new.email,''),254),
    left(trim(coalesce(new.raw_user_meta_data->>'nama','')),100),
    v_username,v_kelas,'',
    left(trim(coalesce(new.raw_user_meta_data->>'sekolah','')),150),
    v_jenjang,''
  ) on conflict (id) do nothing;
  return new;
end; $$;

create or replace function public.choose_member_package(p_package text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Harus login'; end if;
  if not exists(
    select 1 from public.member_packages
    where nama=trim(p_package) and aktif=true
      and nama<>'__PENGATURAN_PEMBAYARAN__'
  ) then raise exception 'Paket tidak tersedia'; end if;

  update public.member_profiles set paket=trim(p_package)
  where id=auth.uid() and status<>'aktif';
  if not found then raise exception 'Paket akun aktif hanya dapat diubah oleh admin'; end if;
end; $$;

revoke all on function public.choose_member_package(text) from public,anon;
grant execute on function public.choose_member_package(text) to authenticated;

revoke select on public.member_profiles from authenticated;
grant select(id,email,nama,username,kelas,wa,sekolah,jenjang,paket,status,berakhir,created_at,updated_at)
  on public.member_profiles to authenticated;

-- Pemeriksaan singkat. Hasil harus menampilkan kolom username dan kelas.
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='member_profiles'
  and column_name in ('username','kelas')
order by column_name;

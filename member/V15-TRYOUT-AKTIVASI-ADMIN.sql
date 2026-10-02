-- KLINIKFISIKAPKU V15
-- PENGAMAN MODE BELAJAR BEBAS + TRYOUT DIAKTIFKAN ADMIN
-- Jalankan sekali SETELAH upgrade Paket Mandiri.

create or replace function public.kf_start_attempt(p_package uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  p public.kf_packages;
  m public.member_profiles;
  used integer;
  aid uuid;
  no integer;
  dl timestamptz;
  has_new_mapping boolean;
  owns_mapped_package boolean;
begin
  select * into p from public.kf_packages where id=p_package;

  if p.id is null then
    raise exception 'Paket soal tidak ditemukan';
  end if;

  -- visible adalah sakelar aktivasi Admin.
  -- Untuk tryout, false berarti benar-benar terkunci walaupun ID RPC diketahui peserta.
  if p.visible is not true then
    if p.kind='tryout' then raise exception 'Tryout belum diaktifkan Admin';
    else raise exception 'Latihan belum tersedia';
    end if;
  end if;

  select * into m from public.member_profiles where id=auth.uid();
  if m.id is null or m.status<>'aktif' then
    raise exception 'Akun peserta tidak aktif';
  end if;

  select exists(
    select 1 from public.kf_package_access x where x.kf_package_id=p.id
  ) into has_new_mapping;

  if has_new_mapping then
    select exists(
      select 1
      from public.kf_package_access x
      where x.kf_package_id=p.id
        and public.kf_user_owns_package(auth.uid(),x.member_package_id)
    ) into owns_mapped_package;

    if not owns_mapped_package then
      raise exception 'Paket ini tidak termasuk paket yang Anda miliki';
    end if;
  else
    -- kompatibilitas konten lama yang belum dipetakan.
    if m.berakhir is not null and m.berakhir<=now() then
      raise exception 'Langganan tidak aktif';
    end if;
    if not public.kf_subscription_match(p.subscription,m.paket) then
      raise exception 'Paket tidak termasuk langganan Anda';
    end if;
  end if;

  if p.jenjang is not null and p.jenjang<>'' and lower(p.jenjang)<>lower(m.jenjang) then
    raise exception 'Jenjang paket tidak sesuai';
  end if;
  if p.starts_at is not null and now()<p.starts_at then
    raise exception 'Paket belum dimulai';
  end if;
  if p.ends_at is not null and now()>p.ends_at then
    raise exception 'Paket sudah berakhir';
  end if;

  select count(*) into used
  from public.kf_attempts
  where package_id=p.id and user_id=auth.uid();

  if p.kind='tryout' and used>=p.max_attempts then
    raise exception 'Batas percobaan tryout sudah habis';
  end if;

  no:=used+1;
  dl:=case
    when p.kind='tryout' and p.duration_minutes>0
      then least(now()+make_interval(mins=>p.duration_minutes),coalesce(p.ends_at,'infinity'::timestamptz))
    else null
  end;

  insert into public.kf_attempts(package_id,user_id,attempt_no,deadline_at)
  values(p.id,auth.uid(),no,dl)
  returning id into aid;

  return jsonb_build_object('attempt_id',aid,'attempt_no',no,'deadline_at',dl);
end $$;

grant execute on function public.kf_start_attempt(uuid) to authenticated;

-- Verifikasi
select
  'kf_start_attempt(uuid)' as object,
  to_regprocedure('public.kf_start_attempt(uuid)') is not null as ok;

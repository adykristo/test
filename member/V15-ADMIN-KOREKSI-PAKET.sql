-- KlinikFisikapku V15 — Admin koreksi paket member
-- Aman: pembatalan mengubah status ownership, tidak menghapus progress/riwayat.

create or replace function public.kf_admin_member_packages(p_user uuid)
returns table(package_id uuid, package_name text, status text, expires_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin') then
    raise exception 'Akses super_admin diperlukan';
  end if;
  return query
  select o.package_id,p.nama,o.status,o.expires_at,o.created_at
  from public.member_package_ownerships o
  join public.member_packages p on p.id=o.package_id
  where o.user_id=p_user
  order by case when o.status='active' then 0 else 1 end,p.urutan,p.nama;
end $$;

create or replace function public.kf_admin_revoke_member_package(p_user uuid,p_package uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare n int;
begin
  if not exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin') then
    raise exception 'Akses super_admin diperlukan';
  end if;
  update public.member_package_ownerships
     set status='expired', expires_at=now()
   where user_id=p_user and package_id=p_package and status='active';
  get diagnostics n=row_count;
  if n=0 then raise exception 'Paket aktif tidak ditemukan'; end if;
  return jsonb_build_object('ok',true,'action','expired','user_id',p_user,'package_id',p_package,'note',coalesce(p_note,''));
end $$;

create or replace function public.kf_admin_grant_member_package(p_user uuid,p_package uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare d int; exp timestamptz;
begin
  if not exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin') then
    raise exception 'Akses super_admin diperlukan';
  end if;
  select durasi_hari into d from public.member_packages where id=p_package and aktif=true;
  if d is null then raise exception 'Paket tidak ditemukan / nonaktif'; end if;
  exp=now()+make_interval(days=>d);
  insert into public.member_package_ownerships(user_id,package_id,status,expires_at)
  values(p_user,p_package,'active',exp)
  on conflict(user_id,package_id) do update set status='active',expires_at=excluded.expires_at;
  return jsonb_build_object('ok',true,'action','granted','user_id',p_user,'package_id',p_package,'expires_at',exp,'note',coalesce(p_note,''));
end $$;

revoke all on function public.kf_admin_member_packages(uuid) from public;
revoke all on function public.kf_admin_revoke_member_package(uuid,uuid,text) from public;
revoke all on function public.kf_admin_grant_member_package(uuid,uuid,text) from public;
grant execute on function public.kf_admin_member_packages(uuid) to authenticated;
grant execute on function public.kf_admin_revoke_member_package(uuid,uuid,text) to authenticated;
grant execute on function public.kf_admin_grant_member_package(uuid,uuid,text) to authenticated;

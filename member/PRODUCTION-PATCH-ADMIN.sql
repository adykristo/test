-- KlinikFisikapku — patch produksi pengelolaan Admin Member
-- Aman dijalankan berulang. Tidak mematikan RLS.

create or replace function public.is_member_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_admins a
    where a.user_id = auth.uid() and a.active = true
  );
$$;

create or replace function public.is_member_super_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_admins a
    where a.user_id = auth.uid() and a.active = true and a.role = 'super_admin'
  );
$$;

create or replace function public.admin_upsert_admin_profile(
  p_user_id uuid,
  p_display_name text,
  p_role text default 'content_admin',
  p_active boolean default true
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_member_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengelola admin';
  end if;
  if p_user_id is null then raise exception 'User ID wajib diisi'; end if;
  if p_role not in ('super_admin','content_admin') then raise exception 'Role admin tidak valid'; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 2 and 100 then
    raise exception 'Nama admin harus 2-100 karakter';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'Akun Auth tidak ditemukan';
  end if;

  insert into public.member_admins(user_id,role,display_name,active,created_by,updated_at)
  values(p_user_id,p_role,trim(p_display_name),p_active,auth.uid(),now())
  on conflict(user_id) do update set
    display_name=excluded.display_name,
    role=excluded.role,
    active=excluded.active,
    updated_at=now();
end;
$$;

create or replace function public.admin_list_admin_accounts()
returns table(user_id uuid,email text,display_name text,role text,active boolean,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_member_super_admin() then
    raise exception 'Hanya Super Admin yang dapat melihat daftar admin';
  end if;
  return query
  select a.user_id, coalesce(u.email,''), a.display_name, a.role, a.active, a.created_at
  from public.member_admins a
  left join auth.users u on u.id=a.user_id
  order by a.created_at;
end;
$$;

create or replace function public.admin_set_admin_active(p_user_id uuid,p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_role text;
begin
  if not public.is_member_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengubah status admin';
  end if;
  select role into v_role from public.member_admins where user_id=p_user_id;
  if v_role is null then raise exception 'Admin tidak ditemukan'; end if;
  if v_role <> 'content_admin' then raise exception 'Super Admin utama dilindungi'; end if;
  update public.member_admins set active=p_active,updated_at=now() where user_id=p_user_id;
end;
$$;

alter table public.member_admins enable row level security;
drop policy if exists "admin_read_own_role" on public.member_admins;
create policy "admin_read_own_role" on public.member_admins
for select to authenticated
using (auth.uid()=user_id or public.is_member_super_admin());

grant select on public.member_admins to authenticated;
grant execute on function public.is_member_admin() to authenticated;
grant execute on function public.is_member_super_admin() to authenticated;
revoke all on function public.admin_upsert_admin_profile(uuid,text,text,boolean) from public,anon;
revoke all on function public.admin_list_admin_accounts() from public,anon;
revoke all on function public.admin_set_admin_active(uuid,boolean) from public,anon;
grant execute on function public.admin_upsert_admin_profile(uuid,text,text,boolean) to authenticated;
grant execute on function public.admin_list_admin_accounts() to authenticated;
grant execute on function public.admin_set_admin_active(uuid,boolean) to authenticated;

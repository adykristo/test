-- KlinikFisikapku V15 — AKSES SEMUA PAKET PER JENJANG
-- Universal: SD/SMP/SMA. Tidak menyentuh Pembuat Soal V13.
-- Prinsip: "Semua Paket SMA" = 12 entitlement paket SMA individual.
-- Dengan demikian Latihan/Tryout/Modul/Video tetap memakai ID paket yang sama.

begin;

-- Fungsi Admin: aktifkan semua paket aktif pada satu jenjang untuk satu peserta.
-- Menggunakan fungsi grant paket yang SUDAH ada agar struktur entitlement/audit lama tetap konsisten.
create or replace function public.kf_admin_grant_level_packages(
  p_user uuid,
  p_jenjang text,
  p_note text default 'Aktivasi semua paket jenjang oleh Admin'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_level text:=upper(trim(coalesce(p_jenjang,'')));
  v_pkg record;
  v_count int:=0;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.kf_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if v_level not in ('SD','SMP','SMA') then raise exception 'INVALID_LEVEL'; end if;

  for v_pkg in
    select id,nama
    from public.member_packages
    where aktif=true and upper(coalesce(jenjang,''))=v_level
    order by urutan,nama
  loop
    -- Pakai RPC grant paket existing agar tidak menebak tabel entitlement.
    select public.kf_admin_grant_member_package(p_user,v_pkg.id,p_note)
      into v_result;
    v_count:=v_count+1;
  end loop;

  if v_count=0 then raise exception 'NO_ACTIVE_PACKAGES_FOR_LEVEL'; end if;

  return jsonb_build_object(
    'ok',true,
    'user_id',p_user,
    'jenjang',v_level,
    'packages_granted',v_count
  );
end;
$$;

revoke all on function public.kf_admin_grant_level_packages(uuid,text,text) from public,anon;
grant execute on function public.kf_admin_grant_level_packages(uuid,text,text) to authenticated;

commit;

-- Verifikasi
select
  case when has_function_privilege('authenticated',
    'public.kf_admin_grant_level_packages(uuid,text,text)','EXECUTE')
  then 'PASS' else 'FAIL' end as authenticated_execute,
  case when not has_function_privilege('anon',
    'public.kf_admin_grant_level_packages(uuid,text,text)','EXECUTE')
  then 'PASS' else 'FAIL' end as anon_blocked;

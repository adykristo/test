-- KlinikFisikapku V15 — FINAL FIX AKSES LATIHAN / TRYOUT
-- Tujuan: kf_user_owns_package membaca member_package_ownerships yang aktif.
-- Berlaku universal SD/SMP/SMA dan paket tunggal.
-- Tidak menyentuh V13, soal, scoring, jawaban, atau progress.

begin;

create or replace function public.kf_user_owns_package(p_package uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.member_package_ownerships o
      where o.user_id = auth.uid()
        and o.package_id = p_package
        and o.status = 'active'
        and (o.expires_at is null or o.expires_at > now())
    );
$$;

revoke all on function public.kf_user_owns_package(uuid) from public,anon;
grant execute on function public.kf_user_owns_package(uuid) to authenticated;

commit;

-- VERIFIKASI STRUKTUR
select
 case when has_function_privilege('authenticated','public.kf_user_owns_package(uuid)','EXECUTE')
      then 'PASS' else 'FAIL' end as authenticated_execute,
 case when not has_function_privilege('anon','public.kf_user_owns_package(uuid)','EXECUTE')
      then 'PASS' else 'FAIL' end as anon_blocked,
 case when pg_get_functiondef('public.kf_user_owns_package(uuid)'::regprocedure)
           like '%member_package_ownerships%'
      then 'PASS' else 'FAIL' end as ownership_source;

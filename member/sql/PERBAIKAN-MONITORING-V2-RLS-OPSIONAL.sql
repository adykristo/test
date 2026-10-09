-- ====================================================================
-- KlinikFisikapku — PERBAIKAN-MONITORING-V2-RLS-OPSIONAL.sql
-- JANGAN JALANKAN TANPA MENINJAU AUDIT-MONITORING-V2-READONLY.sql.
-- HANYA UNTUK kasus: admin sah tidak dapat SELECT salah satu dari tiga
-- tabel relasi ini, meskipun tabel tersebut SUDAH mengaktifkan RLS.
-- Ini TIDAK mengubah kepemilikan paket, transaksi, pembayaran, RLS lama,
-- login, nilai, peserta, dan tidak menambah izin kepada anon.
-- Jika kebutuhan koreksi sebenarnya ada pada RPC SECURITY DEFINER,
-- berkas ini BUKAN solusinya: periksa definisi fungsi terlebih dahulu.
-- ====================================================================

begin;
do $$
declare
 t text;
 table_oid oid;
 f oid;
 function_source text;
begin
 select p.oid,lower(pg_get_functiondef(p.oid))
 into f,function_source
 from pg_proc p
 where p.proname='kf_is_admin'
   and p.pronamespace='public'::regnamespace
   and pg_get_function_identity_arguments(p.oid)=''
 limit 1;

 if f is null then
   raise exception 'STOP: kf_is_admin() tidak ditemukan. Tidak ada perubahan.';
 end if;
 if not (select p.prosecdef from pg_proc p where p.oid=f) then
   raise exception 'STOP: kf_is_admin() bukan SECURITY DEFINER.';
 end if;
 if not exists (
    select 1 from pg_proc p,cross join lateral unnest(coalesce(p.proconfig,array[]::text[])) config
    where p.oid=f and config like 'search_path=%'
 ) then
   raise exception 'STOP: kf_is_admin() tidak memiliki search_path eksplisit.';
 end if;
 if function_source not like '%auth.uid%'
    or function_source not like '%member_admins%'
    or function_source not like '%super_admin%'
    or function_source not like '%active%' then
   raise exception 'STOP: implementasi pemeriksaan admin tidak dikenali.';
 end if;

 foreach t in array array[
   'member_bundle_orders',
   'member_bundle_order_items',
   'member_package_ownerships'
 ] loop
   select c.oid into table_oid
   from pg_class c
   where c.relnamespace='public'::regnamespace
     and c.relname=t and c.relkind in ('r','p');

   if table_oid is null then
     raise exception 'STOP: tabel % tidak ada.',t;
   end if;
   if not (select c.relrowsecurity from pg_class c where c.oid=table_oid) then
     raise exception 'STOP: RLS belum aktif pada %. Jangan tambah policy secara buta.',t;
   end if;
   if not has_table_privilege('authenticated',table_oid,'SELECT') then
     raise exception 'STOP: role authenticated belum memiliki SELECT pada %. Periksa GRANT dan semua policy yang ada terlebih dahulu.',t;
   end if;
   if not exists(
     select 1 from pg_policies p
     where p.schemaname='public' and p.tablename=t
       and p.policyname='kf_monitoring_superadmin_select_v2'
   ) then
     execute format(
       'create policy %I on public.%I for select to authenticated using (public.kf_is_admin())',
       'kf_monitoring_superadmin_select_v2',t
     );
   end if;
 end loop;
end $$;
commit;

-- Setelah berhasil, policy tambahan SELECT ini dapat diperiksa dengan:
select schemaname,tablename,policyname,cmd,roles,qual
from pg_policies
where schemaname='public'
  and policyname='kf_monitoring_superadmin_select_v2'
order by tablename;

-- ROLLBACK MANUAL (HANYA jika policy ini yang baru ditambahkan):
-- begin;
-- drop policy if exists kf_monitoring_superadmin_select_v2 on public.member_bundle_orders;
-- drop policy if exists kf_monitoring_superadmin_select_v2 on public.member_bundle_order_items;
-- drop policy if exists kf_monitoring_superadmin_select_v2 on public.member_package_ownerships;
-- commit;

-- KlinikFisikapku V15 — DIAGNOSTIK AKSES PAKET SMA (READ ONLY)
-- Tidak mengubah fungsi, tabel, paket, peserta, atau soal.
-- Jalankan sekali di Supabase SQL Editor lalu kirim screenshot/hasil.

-- A. Definisi mesin akses yang sedang AKTIF
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'kf_list_available_packages',
    'kf_user_owns_package',
    'kf_start_attempt',
    'kf_member_package_catalog'
  )
order by p.proname;

-- B. Struktur tabel yang menjadi sumber entitlement/pemetaan
select c.table_name,c.column_name,c.data_type,c.is_nullable
from information_schema.columns c
where c.table_schema='public'
  and c.table_name in (
    'member_packages',
    'member_package_ownerships',
    'member_bundle_orders',
    'member_bundle_order_items',
    'kf_packages',
    'kf_package_access'
  )
order by c.table_name,c.ordinal_position;

-- C. Paket peserta SMA aktif (tanpa data pribadi peserta)
select id,nama,kode,jenjang,urutan,aktif
from public.member_packages
where aktif=true
  and (upper(coalesce(jenjang,''))='SMA' or upper(coalesce(nama,'')) like 'SMA%')
order by coalesce(urutan,999),nama;

-- D. Pemetaan paket soal -> paket peserta (tanpa data pribadi)
select ka.kf_package_id,kp.name as paket_soal,kp.kind,
       ka.member_package_id,mp.nama as paket_peserta,mp.kode,mp.jenjang
from public.kf_package_access ka
join public.kf_packages kp on kp.id=ka.kf_package_id
join public.member_packages mp on mp.id=ka.member_package_id
where kp.visible=true
order by kp.updated_at desc nulls last,kp.name
limit 100;

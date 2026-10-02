-- KLINIKFISIKAPKU V15 — DIAGNOSTIK SETELAH INSTALASI
-- Jalankan setelah V15-INSTALL-SUPABASE-FINAL-AUDITED.sql dan setup Super Admin.

-- 1) Tabel wajib
select 'TABLE' as tipe, x as objek, to_regclass('public.'||x) is not null as ok
from unnest(array[
'member_profiles','member_admins','member_packages','member_content','member_progress',
'member_bookmarks','member_answer_attempts','member_admin_logs','kf_packages','kf_questions',
'kf_attempts','kf_answers']) x
union all
-- 2) RPC/fungsi wajib
select 'FUNCTION', x, to_regprocedure('public.'||x) is not null
from unnest(array[
'is_member_admin()','kf_username_available(text)','choose_member_package(text)',
'member_secure_content()','kf_member_question_content()','kf_check_set_answer(text,text,text[])',
'check_member_answer(uuid,jsonb)','touch_member_content(uuid)','admin_list_members_masked()',
'admin_update_member(uuid,text,text,text)','admin_set_member_tahap(uuid,integer)',
'kf_list_available_packages()','kf_start_attempt(uuid)','kf_attempt_questions(uuid)',
'kf_save_answer(uuid,uuid,jsonb)','kf_submit_attempt(uuid,boolean)','kf_my_results()']) x
order by tipe,objek;

-- 3) Trigger profil member harus ada dan aktif
select tgname as trigger_name, tgenabled
from pg_trigger
where tgrelid='auth.users'::regclass and tgname='on_auth_user_created_kf';

-- 4) Super Admin yang aktif
select a.user_id,u.email,a.role,a.active
from public.member_admins a
join auth.users u on u.id=a.user_id
order by u.email;

-- 5) Paket + konfigurasi pembayaran
select nama,durasi_hari,harga,aktif,deskripsi
from public.member_packages
order by case when nama='_PAYMENT_CONFIG_' then 1 else 0 end, harga;

-- 6) RLS harus aktif untuk semua tabel inti
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
'member_profiles','member_admins','member_packages','member_content','member_progress',
'member_bookmarks','member_answer_attempts','member_admin_logs','kf_packages','kf_questions',
'kf_attempts','kf_answers')
order by c.relname;

-- 7) Ringkasan cepat: hasil ideal adalah 12 tabel dengan RLS=true, admin aktif, dan seluruh fungsi pada blok (2) = true.
-- Jika salah satu hasil false/kosong, JANGAN deploy frontend sebelum penyebabnya diperbaiki.

-- KLINIKFISIKAPKU MEMBER AREA - RESET BERSIH
-- PERINGATAN: skrip ini menghapus SELURUH tabel public bernama member_* beserta datanya.
-- auth.users TIDAK dihapus. Gunakan hanya bila benar-benar ingin instalasi Member Area dari awal.

begin;

drop trigger if exists on_auth_user_created_member on auth.users;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname='public' and tablename like 'member\_%' escape '\'
  loop
    execute format('drop table if exists %I.%I cascade', r.schemaname, r.tablename);
  end loop;
end $$;

-- Hapus fungsi aplikasi Member Area lama di public agar tidak ada definisi usang.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.proname like 'member\_%' escape '\'
           or p.proname like 'kf\_%' escape '\'
           or p.proname in ('handle_new_member','choose_member_package','complete_member_profile','check_member_answer','touch_member_content','create_member_order','is_member_admin','is_member_super_admin'))
  loop
    execute 'drop function if exists ' || r.signature || ' cascade';
  end loop;
end $$;

commit;

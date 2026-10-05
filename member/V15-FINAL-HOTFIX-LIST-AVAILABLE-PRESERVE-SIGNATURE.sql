-- KlinikFisikapku V15 — HOTFIX kf_list_available_packages
-- Mempertahankan RETURNS TABLE/signature aktif PERSIS dari database.
-- Tidak DROP function. Tidak menyentuh V13 / soal / jawaban / scoring.

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.kf_list_available_packages()'::regprocedure);

  if position('public.kf_subscription_match(p.subscription,m.paket)' in v_def)=0 then
    if position('public.kf_package_access' in v_def)>0 then
      raise notice 'Sudah memakai kf_package_access; tidak ada perubahan.';
      return;
    end if;
    raise exception 'FILTER_LAMA_TIDAK_DITEMUKAN - fungsi tidak diubah';
  end if;

  v_def := replace(
    v_def,
    'public.kf_subscription_match(p.subscription,m.paket)',
    'exists (select 1 from public.kf_package_access ka where ka.kf_package_id=p.id and public.kf_user_owns_package(ka.member_package_id))'
  );
  v_def := replace(v_def,'and public.kf_scope_match(p.jenjang,m.jenjang)','');
  v_def := replace(v_def,'and public.kf_scope_match(p.kelas,m.kelas)','');

  execute v_def;
end $$;

revoke all on function public.kf_list_available_packages() from public,anon;
grant execute on function public.kf_list_available_packages() to authenticated;

select
 case when has_function_privilege('authenticated','public.kf_list_available_packages()','EXECUTE') then 'PASS' else 'FAIL' end as authenticated_execute,
 case when not has_function_privilege('anon','public.kf_list_available_packages()','EXECUTE') then 'PASS' else 'FAIL' end as anon_blocked,
 case when pg_get_functiondef('public.kf_list_available_packages()'::regprocedure) like '%kf_package_access%' then 'PASS' else 'FAIL' end as uses_package_access,
 case when pg_get_functiondef('public.kf_list_available_packages()'::regprocedure) not like '%kf_subscription_match%' then 'PASS' else 'FAIL' end as legacy_subscription_removed,
 case when pg_get_functiondef('public.kf_list_available_packages()'::regprocedure) not like '%kf_scope_match%' then 'PASS' else 'FAIL' end as legacy_scope_removed;

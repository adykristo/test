-- Jalankan SETELAH akun admin dibuat di Authentication > Users.
-- Ganti email di bawah dengan email akun admin Anda.
do $$
declare uid uuid;
begin
 select id into uid from auth.users where lower(email)=lower('adykristo@gmail.com') limit 1;
 if uid is null then raise exception 'Akun Auth dengan email tersebut belum ada'; end if;
 insert into public.member_admins(user_id,role,active) values(uid,'super_admin',true)
 on conflict(user_id) do update set role='super_admin',active=true;
 update public.member_profiles set status='aktif',tahap_terbuka=12 where id=uid;
end $$;
select a.user_id,u.email,a.role,a.active from public.member_admins a join auth.users u on u.id=a.user_id;

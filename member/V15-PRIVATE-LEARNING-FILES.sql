-- KlinikFisikapku V15 — PRIVATE LEARNING FILES (AUDITED)
-- Jalankan setelah V15-SECURITY-HARDEN-ADMIN-TABLES.sql.
-- Upload baru memakai path: <package_uuid>/<random>-file.pdf
-- Peserta hanya dapat membuat signed URL jika memiliki package folder tersebut.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learning-files','learning-files',false,104857600,array['application/pdf'])
on conflict(id) do update set
 public=false,
 file_size_limit=104857600,
 allowed_mime_types=array['application/pdf'];

drop policy if exists "KF admin upload learning files" on storage.objects;
drop policy if exists "KF admin update learning files" on storage.objects;
drop policy if exists "KF admin delete learning files" on storage.objects;
drop policy if exists "KF admin select learning files" on storage.objects;
drop policy if exists "KF member read owned learning files" on storage.objects;

-- Hanya Super Admin boleh menulis/mengubah/menghapus.
create policy "KF admin upload learning files"
on storage.objects for insert to authenticated
with check(bucket_id='learning-files' and public.kf_is_admin());

create policy "KF admin update learning files"
on storage.objects for update to authenticated
using(bucket_id='learning-files' and public.kf_is_admin())
with check(bucket_id='learning-files' and public.kf_is_admin());

create policy "KF admin delete learning files"
on storage.objects for delete to authenticated
using(bucket_id='learning-files' and public.kf_is_admin());

-- SELECT dibutuhkan oleh Storage API createSignedUrl().
-- Folder pertama WAJIB package UUID. Peserta hanya lolos bila ownership aktif.
create policy "KF member read owned learning files"
on storage.objects for select to authenticated
using(
 bucket_id='learning-files'
 and (
   public.kf_is_admin()
   or exists(
     select 1
     from public.member_package_ownerships o
     where o.user_id=auth.uid()
       and o.status='active'
       and (o.expires_at is null or o.expires_at>now())
       and o.package_id::text=(storage.foldername(name))[1]
   )
 )
);

commit;

-- VERIFIKASI
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='learning-files';

select policyname,cmd,roles
from pg_policies
where schemaname='storage' and tablename='objects'
and policyname in (
 'KF admin upload learning files','KF admin update learning files',
 'KF admin delete learning files','KF member read owned learning files'
)
order by policyname;

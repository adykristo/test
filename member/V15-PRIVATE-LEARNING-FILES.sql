-- KlinikFisikapku V15 — PRIVATE LEARNING FILES (SAFE MIGRATION)
-- TIDAK mengubah bucket legacy "learning-files".
-- Upload baru masuk bucket "learning-files-private".
-- Path: <package_uuid>/<random>-file.pdf
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learning-files-private','learning-files-private',false,104857600,array['application/pdf'])
on conflict(id) do update set
 public=false,
 file_size_limit=104857600,
 allowed_mime_types=array['application/pdf'];

drop policy if exists "KF admin upload private learning files" on storage.objects;
drop policy if exists "KF admin update private learning files" on storage.objects;
drop policy if exists "KF admin delete private learning files" on storage.objects;
drop policy if exists "KF member read owned private learning files" on storage.objects;

create policy "KF admin upload private learning files"
on storage.objects for insert to authenticated
with check(bucket_id='learning-files-private' and public.kf_is_admin());

create policy "KF admin update private learning files"
on storage.objects for update to authenticated
using(bucket_id='learning-files-private' and public.kf_is_admin())
with check(bucket_id='learning-files-private' and public.kf_is_admin());

create policy "KF admin delete private learning files"
on storage.objects for delete to authenticated
using(bucket_id='learning-files-private' and public.kf_is_admin());

-- createSignedUrl() membutuhkan SELECT. Folder pertama adalah package UUID.
create policy "KF member read owned private learning files"
on storage.objects for select to authenticated
using(
 bucket_id='learning-files-private'
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

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in ('learning-files','learning-files-private')
order by id;

select policyname,cmd,roles
from pg_policies
where schemaname='storage' and tablename='objects'
and policyname in (
 'KF admin upload private learning files',
 'KF admin update private learning files',
 'KF admin delete private learning files',
 'KF member read owned private learning files'
)
order by policyname;

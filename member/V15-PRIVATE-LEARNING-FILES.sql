-- KlinikFisikapku V15 — PRIVATE LEARNING FILES
-- Tujuan: upload PDF baru disimpan private dan peserta hanya memperoleh signed URL
-- jika content tersebut termasuk paket aktif miliknya.
-- File/URL lama tetap kompatibel dan tidak dimigrasikan otomatis.
begin;

-- Bucket learning-files dibuat PRIVATE. Limit 100 MB, hanya PDF.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('learning-files','learning-files',false,104857600,array['application/pdf'])
on conflict(id) do update set
 public=false,
 file_size_limit=104857600,
 allowed_mime_types=array['application/pdf'];

-- Bersihkan policy lama bucket ini agar tidak ada SELECT publik/member umum.
drop policy if exists "KF admin upload learning files" on storage.objects;
drop policy if exists "KF admin update learning files" on storage.objects;
drop policy if exists "KF admin delete learning files" on storage.objects;
drop policy if exists "KF admin select learning files" on storage.objects;

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

create policy "KF admin select learning files"
on storage.objects for select to authenticated
using(bucket_id='learning-files' and public.kf_is_admin());

-- Mengembalikan signed URL 10 menit untuk file private milik suatu content.
-- Path dibaca dari member_content.data.storage_path, sehingga user tidak dapat
-- memasukkan arbitrary storage path.
create or replace function public.kf_content_file_url(p_content_id uuid)
returns text
language plpgsql
security definer
set search_path=public,storage,extensions
as $$
declare
 v_uid uuid:=auth.uid();
 v_path text;
 v_ok boolean:=false;
 v_signed text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

 -- Admin boleh preview semua content.
 if public.kf_is_admin() then
   v_ok:=true;
 else
   select exists(
     select 1
     from public.member_content c
     join public.member_content_packages cp on cp.content_id=c.id
     join public.member_package_ownerships o
       on o.package_id=cp.package_id
      and o.user_id=v_uid
      and o.status='active'
      and (o.expires_at is null or o.expires_at>now())
     where c.id=p_content_id
       and c.visible=true
   ) into v_ok;
 end if;

 if not v_ok then raise exception 'CONTENT_ACCESS_DENIED'; end if;

 select nullif(c.data->>'storage_path','')
 into v_path
 from public.member_content c
 where c.id=p_content_id;

 if v_path is null then return null; end if;
 if v_path like '../%' or v_path like '%/../%' then raise exception 'INVALID_STORAGE_PATH'; end if;

 -- storage.sign_object returns a signed URL/path using Supabase Storage internals.
 select storage.foldername(v_path::text)::text into v_signed; -- force storage schema resolution check
 v_signed:=storage.sign_object('learning-files',v_path,600);
 return v_signed;
end;
$$;

revoke all on function public.kf_content_file_url(uuid) from public;
grant execute on function public.kf_content_file_url(uuid) to authenticated;

commit;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='learning-files';

select policyname,cmd,roles
from pg_policies
where schemaname='storage' and tablename='objects'
and policyname like 'KF admin % learning files'
order by policyname;

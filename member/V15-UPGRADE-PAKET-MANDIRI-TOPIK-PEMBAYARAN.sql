-- ============================================================================
-- KLINIKFISIKAPKU V15 — UPGRADE PAKET MANDIRI + TOPIK + DISTRIBUSI + PEMBAYARAN
-- Jalankan SETELAH installer V15 final.
-- Tidak menghapus member, konten, soal V12, attempt, atau admin yang sudah ada.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. PAKET: tambah kode/urutan agar paket bisa ditambah, diurutkan, dinonaktifkan.
alter table public.member_packages add column if not exists kode text;
alter table public.member_packages add column if not exists urutan integer not null default 0;
alter table public.member_packages add column if not exists warna text not null default '';
alter table public.member_packages add column if not exists updated_at timestamptz not null default now();

create unique index if not exists member_packages_kode_uq
  on public.member_packages(lower(kode)) where kode is not null and kode<>'';
create index if not exists member_packages_urutan_idx on public.member_packages(aktif,urutan,nama);

-- 2. TOPIK PER PAKET
create table if not exists public.member_package_topics (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.member_packages(id) on delete cascade,
  judul text not null,
  deskripsi text not null default '',
  urutan integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(package_id,judul)
);
create index if not exists member_package_topics_idx
  on public.member_package_topics(package_id,visible,urutan);

drop trigger if exists trg_member_package_topics_updated on public.member_package_topics;
create trigger trg_member_package_topics_updated
before update on public.member_package_topics
for each row execute function public.kf_set_updated_at();

-- 3. KEPEMILIKAN PAKET INDIVIDUAL.
-- Satu peserta boleh memiliki Paket 1, 4, 12 sekaligus; paket lain tetap terkunci.
create table if not exists public.member_package_ownerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.member_packages(id) on delete restrict,
  status text not null default 'pending'
    check(status in ('pending','active','expired','rejected','cancelled')),
  purchased_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  price_paid bigint not null default 0 check(price_paid>=0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_package_ownerships_user_idx
  on public.member_package_ownerships(user_id,status,expires_at);
create index if not exists member_package_ownerships_package_idx
  on public.member_package_ownerships(package_id,status);

drop trigger if exists trg_member_package_ownerships_updated on public.member_package_ownerships;
create trigger trg_member_package_ownerships_updated
before update on public.member_package_ownerships
for each row execute function public.kf_set_updated_at();

-- 4. DISTRIBUSI KONTEN LAMA (modul/video/latihan individual) KE PAKET + TOPIK.
create table if not exists public.member_content_packages (
  content_id uuid not null references public.member_content(id) on delete cascade,
  package_id uuid not null references public.member_packages(id) on delete cascade,
  topic_id uuid references public.member_package_topics(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(content_id,package_id)
);
create index if not exists member_content_packages_pkg_idx
  on public.member_content_packages(package_id,topic_id);

-- 5. DISTRIBUSI PAKET SOAL V15 (latihan/tryout dari V12) KE PAKET + TOPIK.
create table if not exists public.kf_package_access (
  kf_package_id uuid not null references public.kf_packages(id) on delete cascade,
  member_package_id uuid not null references public.member_packages(id) on delete cascade,
  topic_id uuid references public.member_package_topics(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(kf_package_id,member_package_id)
);
create index if not exists kf_package_access_member_pkg_idx
  on public.kf_package_access(member_package_id,topic_id);

-- 6. MULTI METODE PEMBAYARAN
create table if not exists public.member_payment_methods (
  id uuid primary key default gen_random_uuid(),
  jenis text not null default 'bank'
    check(jenis in ('bank','ewallet','qris','lainnya')),
  nama text not null,
  nomor_akun text not null default '',
  pemilik text not null default '',
  whatsapp text not null default '',
  instruksi text not null default '',
  qr_image text not null default '',
  urutan integer not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_payment_methods_idx
  on public.member_payment_methods(aktif,urutan,nama);

drop trigger if exists trg_member_payment_methods_updated on public.member_payment_methods;
create trigger trg_member_payment_methods_updated
before update on public.member_payment_methods
for each row execute function public.kf_set_updated_at();

-- 7. TRANSAKSI PEMBELIAN. Harga disalin saat transaksi agar histori tidak berubah.
create table if not exists public.member_package_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id uuid not null references public.member_packages(id) on delete restrict,
  payment_method_id uuid references public.member_payment_methods(id) on delete set null,
  amount bigint not null default 0 check(amount>=0),
  status text not null default 'pending'
    check(status in ('pending','paid','approved','rejected','cancelled')),
  proof_url text not null default '',
  note_member text not null default '',
  note_admin text not null default '',
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null
);
create index if not exists member_package_orders_user_idx
  on public.member_package_orders(user_id,created_at desc);
create index if not exists member_package_orders_status_idx
  on public.member_package_orders(status,created_at desc);

-- 8. MIGRASI AMAN konfigurasi rekening lama menjadi metode pembayaran pertama.
do $$
declare cfg jsonb; b text; n text; p text; w text;
begin
  select case when deskripsi ~ '^\s*\{' then deskripsi::jsonb else '{}'::jsonb end
  into cfg from public.member_packages where nama='_PAYMENT_CONFIG_' limit 1;
  if cfg is not null then
    b:=coalesce(cfg->>'bank',''); n:=coalesce(cfg->>'nomorRekening','');
    p:=coalesce(cfg->>'pemilikRekening',''); w:=coalesce(cfg->>'whatsapp','');
    if b<>'' and not exists(
      select 1 from public.member_payment_methods
      where lower(nama)=lower(b) and nomor_akun=n
    ) then
      insert into public.member_payment_methods(jenis,nama,nomor_akun,pemilik,whatsapp,urutan,aktif)
      values('bank',b,n,p,w,1,true);
    end if;
  end if;
exception when others then
  raise notice 'Konfigurasi pembayaran lama tidak dimigrasikan: %',sqlerrm;
end $$;

-- 9. Helper: apakah peserta memiliki paket aktif tertentu?
create or replace function public.kf_user_owns_package(p_user uuid,p_package uuid)
returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.member_package_ownerships o
    where o.user_id=p_user and o.package_id=p_package and o.status='active'
      and (o.expires_at is null or o.expires_at>now())
  )
$$;
revoke all on function public.kf_user_owns_package(uuid,uuid) from public;
grant execute on function public.kf_user_owns_package(uuid,uuid) to authenticated;

-- 10. Daftar paket untuk dashboard peserta + status kepemilikan.
create or replace function public.kf_member_package_catalog()
returns table(
  package_id uuid,nama text,durasi_hari integer,harga bigint,deskripsi text,
  urutan integer,owned_status text,expires_at timestamptz,ever_purchased boolean
)
language sql stable security definer set search_path=public as $$
  select p.id,p.nama,p.durasi_hari,p.harga,p.deskripsi,p.urutan,
    coalesce((
      select case
        when o.status='active' and (o.expires_at is null or o.expires_at>now()) then 'active'
        when o.status='pending' then 'pending'
        else 'expired'
      end
      from public.member_package_ownerships o
      where o.user_id=auth.uid() and o.package_id=p.id
      order by
        case when o.status='active' and (o.expires_at is null or o.expires_at>now()) then 0
             when o.status='pending' then 1 else 2 end,
        o.created_at desc limit 1
    ),'locked') as owned_status,
    (select max(o.expires_at) from public.member_package_ownerships o
      where o.user_id=auth.uid() and o.package_id=p.id and o.status='active') as expires_at,
    exists(select 1 from public.member_package_ownerships o
      where o.user_id=auth.uid() and o.package_id=p.id) as ever_purchased
  from public.member_packages p
  where p.aktif=true and p.nama<>'_PAYMENT_CONFIG_'
  order by p.urutan,p.nama
$$;
grant execute on function public.kf_member_package_catalog() to authenticated;

-- 11. Topik yang boleh dilihat peserta hanya dari paket yang sedang dimiliki.
create or replace function public.kf_member_topics()
returns table(topic_id uuid,package_id uuid,package_name text,judul text,deskripsi text,urutan integer)
language sql stable security definer set search_path=public as $$
  select t.id,t.package_id,p.nama,t.judul,t.deskripsi,t.urutan
  from public.member_package_topics t
  join public.member_packages p on p.id=t.package_id
  where t.visible=true and p.aktif=true
    and public.kf_user_owns_package(auth.uid(),t.package_id)
  order by p.urutan,t.urutan,t.judul
$$;
grant execute on function public.kf_member_topics() to authenticated;

-- 12. Metode pembayaran aktif untuk peserta.
create or replace function public.kf_payment_methods()
returns table(id uuid,jenis text,nama text,nomor_akun text,pemilik text,whatsapp text,instruksi text,qr_image text,urutan integer)
language sql stable security definer set search_path=public as $$
 select m.id,m.jenis,m.nama,m.nomor_akun,m.pemilik,m.whatsapp,m.instruksi,m.qr_image,m.urutan
 from public.member_payment_methods m where m.aktif=true order by m.urutan,m.nama
$$;
grant execute on function public.kf_payment_methods() to anon,authenticated;

-- 13. Peserta membuat order paket baru; pembelian lama tidak ditimpa.
create or replace function public.kf_create_package_order(p_package uuid,p_payment_method uuid default null)
returns uuid
language plpgsql security definer set search_path=public as $$
declare oid uuid; price bigint;
begin
 if auth.uid() is null then raise exception 'Harus login'; end if;
 select harga into price from public.member_packages
 where id=p_package and aktif=true and nama<>'_PAYMENT_CONFIG_';
 if price is null then raise exception 'Paket tidak tersedia'; end if;
 if public.kf_user_owns_package(auth.uid(),p_package) then
   raise exception 'Paket ini masih aktif pada akun Anda';
 end if;
 if p_payment_method is not null and not exists(
   select 1 from public.member_payment_methods where id=p_payment_method and aktif=true
 ) then raise exception 'Metode pembayaran tidak tersedia'; end if;

 insert into public.member_package_orders(user_id,package_id,payment_method_id,amount)
 values(auth.uid(),p_package,p_payment_method,price) returning id into oid;
 return oid;
end $$;
grant execute on function public.kf_create_package_order(uuid,uuid) to authenticated;

-- 14. Admin menyetujui order -> tambah kepemilikan baru, TIDAK menghapus paket lama.
create or replace function public.kf_admin_approve_order(p_order uuid,p_note text default '')
returns boolean
language plpgsql security definer set search_path=public as $$
declare o public.member_package_orders; d integer;
begin
 if not public.is_member_admin() then raise exception 'Akses admin ditolak'; end if;
 select * into o from public.member_package_orders where id=p_order for update;
 if o.id is null then raise exception 'Order tidak ditemukan'; end if;
 if o.status='approved' then return true; end if;
 select durasi_hari into d from public.member_packages where id=o.package_id;
 if d is null then raise exception 'Paket tidak ditemukan'; end if;

 update public.member_package_orders
 set status='approved',verified_at=now(),verified_by=auth.uid(),note_admin=p_note
 where id=o.id;

 insert into public.member_package_ownerships(
   user_id,package_id,status,purchased_at,activated_at,expires_at,price_paid,note
 ) values(
   o.user_id,o.package_id,'active',o.created_at,now(),now()+make_interval(days=>d),o.amount,p_note
 );

 -- status profil dipertahankan untuk kompatibilitas halaman lama.
 update public.member_profiles
 set status='aktif',
     mulai=coalesce(mulai,now()),
     berakhir=greatest(coalesce(berakhir,now()),now()+make_interval(days=>d))
 where id=o.user_id and status<>'dihapus';

 perform public.kf_admin_log('approve_package_order','package_order',o.id::text,
   jsonb_build_object('package_id',o.package_id,'amount',o.amount));
 return true;
end $$;
grant execute on function public.kf_admin_approve_order(uuid,text) to authenticated;

-- 15. Konten member aman: jika konten sudah didistribusikan ke paket,
--     peserta wajib memiliki salah satu paket tersebut. Konten lama tanpa mapping
--     tetap memakai aturan lama selama masa transisi.
drop function if exists public.member_secure_content();
create function public.member_secure_content()
returns table(id uuid,jenjang text,jenis text,tujuan text,topik text,judul text,visible boolean,data jsonb,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,c.jenjang,c.jenis,c.tujuan,c.topik,c.judul,c.visible,
   case when c.jenis='soal' then c.data - 'kunci' - 'pembahasan' else c.data end,
   c.created_at
 from public.member_content c
 join public.member_profiles p on p.id=auth.uid()
 where c.visible=true and p.status='aktif'
   and c.jenjang=p.jenjang
   and (
     (exists(select 1 from public.member_content_packages cp where cp.content_id=c.id)
       and exists(
         select 1 from public.member_content_packages cp
         where cp.content_id=c.id
           and public.kf_user_owns_package(auth.uid(),cp.package_id)
       ))
     or
     (not exists(select 1 from public.member_content_packages cp where cp.content_id=c.id)
       and (p.berakhir is null or p.berakhir>now())
       and coalesce((c.data->>'learning_stage')::int,1)<=greatest(p.tahap_terbuka,1)
       and (not (c.data ? 'packages') or jsonb_typeof(c.data->'packages')<>'array'
            or jsonb_array_length(c.data->'packages')=0 or (c.data->'packages') ? p.paket))
   )
 order by c.created_at desc
$$;
grant execute on function public.member_secure_content() to authenticated;

-- 16. Paket latihan/tryout V15: jika sudah punya mapping baru, pakai ownership.
--     Jika belum, tetap kompatibel dengan subscription lama.
drop function if exists public.kf_list_available_packages();
create function public.kf_list_available_packages()
returns table(id uuid,kind text,name text,jenjang text,kelas text,mapel text,duration_minutes integer,starts_at timestamptz,ends_at timestamptz,max_attempts integer,question_count bigint,attempts_used bigint)
language sql stable security definer set search_path=public as $$
 select p.id,p.kind,p.name,p.jenjang,p.kelas,p.mapel,p.duration_minutes,p.starts_at,p.ends_at,p.max_attempts,
 (select count(*) from public.kf_questions q where q.package_id=p.id),
 (select count(*) from public.kf_attempts a where a.package_id=p.id and a.user_id=auth.uid())
 from public.kf_packages p
 join public.member_profiles m on m.id=auth.uid()
 where p.visible=true and m.status='aktif'
 and (p.jenjang is null or p.jenjang='' or lower(p.jenjang)=lower(m.jenjang))
 and (
   (exists(select 1 from public.kf_package_access x where x.kf_package_id=p.id)
     and exists(
       select 1 from public.kf_package_access x
       where x.kf_package_id=p.id
         and public.kf_user_owns_package(auth.uid(),x.member_package_id)
     ))
   or
   (not exists(select 1 from public.kf_package_access x where x.kf_package_id=p.id)
     and (m.berakhir is null or m.berakhir>now())
     and public.kf_subscription_match(p.subscription,m.paket))
 )
 order by p.created_at desc
$$;
grant execute on function public.kf_list_available_packages() to authenticated;

-- 17. RLS
alter table public.member_package_topics enable row level security;
alter table public.member_package_ownerships enable row level security;
alter table public.member_content_packages enable row level security;
alter table public.kf_package_access enable row level security;
alter table public.member_payment_methods enable row level security;
alter table public.member_package_orders enable row level security;

drop policy if exists kf_pkg_topics_admin_all on public.member_package_topics;
create policy kf_pkg_topics_admin_all on public.member_package_topics
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

drop policy if exists kf_pkg_topics_member_read on public.member_package_topics;
create policy kf_pkg_topics_member_read on public.member_package_topics
for select to authenticated using(
 visible=true and public.kf_user_owns_package(auth.uid(),package_id)
);

drop policy if exists kf_ownership_self_read on public.member_package_ownerships;
create policy kf_ownership_self_read on public.member_package_ownerships
for select to authenticated using(user_id=auth.uid() or public.is_member_admin());

drop policy if exists kf_ownership_admin_all on public.member_package_ownerships;
create policy kf_ownership_admin_all on public.member_package_ownerships
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

drop policy if exists kf_content_packages_admin_all on public.member_content_packages;
create policy kf_content_packages_admin_all on public.member_content_packages
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

drop policy if exists kf_package_access_admin_all on public.kf_package_access;
create policy kf_package_access_admin_all on public.kf_package_access
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

drop policy if exists kf_payment_methods_public_read on public.member_payment_methods;
create policy kf_payment_methods_public_read on public.member_payment_methods
for select to anon,authenticated using(aktif=true);

drop policy if exists kf_payment_methods_admin_all on public.member_payment_methods;
create policy kf_payment_methods_admin_all on public.member_payment_methods
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

drop policy if exists kf_orders_self_read on public.member_package_orders;
create policy kf_orders_self_read on public.member_package_orders
for select to authenticated using(user_id=auth.uid() or public.is_member_admin());

drop policy if exists kf_orders_admin_all on public.member_package_orders;
create policy kf_orders_admin_all on public.member_package_orders
for all to authenticated using(public.is_member_admin()) with check(public.is_member_admin());

-- 18. Privileges
grant select,insert,update,delete on public.member_package_topics to authenticated;
grant select,insert,update,delete on public.member_package_ownerships to authenticated;
grant select,insert,update,delete on public.member_content_packages to authenticated;
grant select,insert,update,delete on public.kf_package_access to authenticated;
grant select on public.member_payment_methods to anon,authenticated;
grant insert,update,delete on public.member_payment_methods to authenticated;
grant select on public.member_package_orders to authenticated;
grant insert,update,delete on public.member_package_orders to authenticated;

-- 19. VERIFIKASI
select 'TABLE' as tipe,x as objek,to_regclass('public.'||x) is not null as ok
from unnest(array[
 'member_package_topics','member_package_ownerships','member_content_packages',
 'kf_package_access','member_payment_methods','member_package_orders'
]) x
union all
select 'FUNCTION',x,to_regprocedure('public.'||x) is not null
from unnest(array[
 'kf_user_owns_package(uuid,uuid)',
 'kf_member_package_catalog()',
 'kf_member_topics()',
 'kf_payment_methods()',
 'kf_create_package_order(uuid,uuid)',
 'kf_admin_approve_order(uuid,text)'
]) x
order by tipe,objek;

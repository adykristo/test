-- KlinikFisikapku V15 — Batalkan / arsipkan permintaan paket
-- Tidak menghapus ownership/progress peserta.

create or replace function public.kf_admin_cancel_bundle_order(p_order uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin') then raise exception 'Akses super_admin diperlukan'; end if;
  update public.member_bundle_orders set status='cancelled' where id=p_order and status='pending';
  if not found then raise exception 'Permintaan pending tidak ditemukan'; end if;
  return jsonb_build_object('ok',true,'status','cancelled','order_id',p_order,'note',coalesce(p_note,''));
end $$;

create or replace function public.kf_admin_archive_bundle_order(p_order uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.member_admins a where a.user_id=auth.uid() and a.active=true and a.role='super_admin') then raise exception 'Akses super_admin diperlukan'; end if;
  update public.member_bundle_orders set status='archived' where id=p_order and status in ('pending','cancelled');
  if not found then raise exception 'Permintaan tidak dapat diarsipkan'; end if;
  return jsonb_build_object('ok',true,'status','archived','order_id',p_order,'note',coalesce(p_note,''));
end $$;

revoke all on function public.kf_admin_cancel_bundle_order(uuid,text) from public;
revoke all on function public.kf_admin_archive_bundle_order(uuid,text) from public;
grant execute on function public.kf_admin_cancel_bundle_order(uuid,text) to authenticated;
grant execute on function public.kf_admin_archive_bundle_order(uuid,text) to authenticated;

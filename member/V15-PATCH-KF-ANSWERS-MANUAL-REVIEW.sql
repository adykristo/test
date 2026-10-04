-- KlinikFisikapku V15
-- Patch kompatibilitas kf_save_answer / kf_submit_attempt_v13.
-- Aman dijalankan berulang. Tidak menghapus data.

begin;

alter table public.kf_answers
  add column if not exists needs_manual_review boolean not null default false;

comment on column public.kf_answers.needs_manual_review is
  'True bila jawaban membutuhkan koreksi manual (mis. esai); dikelola oleh RPC server-side.';

commit;

-- Verifikasi
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema='public'
  and table_name='kf_answers'
  and column_name='needs_manual_review';

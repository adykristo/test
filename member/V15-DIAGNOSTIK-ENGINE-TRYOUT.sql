-- KlinikFisikapku V15/V13 — DIAGNOSTIK ENGINE TRYOUT
-- AMAN / READ-ONLY: tidak CREATE, DROP, ALTER, UPDATE, DELETE, atau INSERT.
-- Jalankan seluruh isi file ini di Supabase SQL Editor.
-- Hasil dipakai untuk audit kf_start_attempt, kf_save_answer, kf_submit_attempt.

-- 1) Definisi fungsi RPC aktif
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'kf_start_attempt',
    'kf_attempt_questions',
    'kf_save_answer',
    'kf_submit_attempt',
    'kf_my_results'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 2) Struktur tabel inti engine soal/tryout
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema='public'
  and c.table_name in (
    'kf_packages',
    'kf_questions',
    'kf_attempts',
    'kf_answers',
    'kf_attempt_answers',
    'kf_results'
  )
order by c.table_name, c.ordinal_position;

-- 3) Constraint tabel inti (untuk memastikan relasi & unique key)
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name=kcu.constraint_name
 and tc.constraint_schema=kcu.constraint_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name=ccu.constraint_name
 and tc.constraint_schema=ccu.constraint_schema
where tc.table_schema='public'
  and tc.table_name in (
    'kf_packages',
    'kf_questions',
    'kf_attempts',
    'kf_answers',
    'kf_attempt_answers',
    'kf_results'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- CATATAN:
-- Jangan kirim API key, service_role key, password, atau secret.
-- Cukup kirim screenshot/hasil query ini kepada ChatGPT.

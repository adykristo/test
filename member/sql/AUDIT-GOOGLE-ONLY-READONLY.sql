-- KlinikFisikapku: AUDIT migrasi Google-only (BACA SAJA)
-- Jalankan pada SQL Editor produksi; jangan menonaktifkan Email Provider dulu.
-- Tidak menampilkan email, nama, ID peserta atau token.
WITH identities AS (
 SELECT u.id, coalesce(u.raw_app_meta_data->>'provider','') AS primary_provider,
        EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='google') AS google_linked,
        EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id=u.id AND i.provider='email') AS email_linked
 FROM auth.users u
), summary AS (
 SELECT count(*) AS total_auth,
        count(*) FILTER (WHERE google_linked) AS google_linked,
        count(*) FILTER (WHERE NOT google_linked) AS not_google_linked,
        count(*) FILTER (WHERE email_linked AND NOT google_linked) AS email_only,
        count(*) FILTER (WHERE google_linked AND email_linked) AS both_linked
 FROM identities
), member AS (
 SELECT count(*) AS profiles,
        count(*) FILTER (WHERE i.google_linked) AS profiles_google_linked,
        count(*) FILTER (WHERE NOT i.google_linked) AS profiles_not_google_linked
 FROM public.member_profiles p
 LEFT JOIN identities i ON i.id=p.id
)
SELECT 'Auth total' AS pemeriksaan,total_auth::text AS hasil FROM summary
UNION ALL SELECT 'Auth Google terhubung',google_linked::text FROM summary
UNION ALL SELECT 'Auth belum Google',not_google_linked::text FROM summary
UNION ALL SELECT 'Auth hanya email',email_only::text FROM summary
UNION ALL SELECT 'Auth email dan Google',both_linked::text FROM summary
UNION ALL SELECT 'Profil peserta',profiles::text FROM member
UNION ALL SELECT 'Profil peserta sudah Google',profiles_google_linked::text FROM member
UNION ALL SELECT 'Profil peserta belum Google',profiles_not_google_linked::text FROM member;

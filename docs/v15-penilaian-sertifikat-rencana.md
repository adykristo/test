# KlinikFisikapku V15 — Penilaian Terpadu & Sertifikat Per Paket

Status: **pengembangan, belum boleh merge/deploy**. Baseline tetap `baseline-v15-2026-10-11`.

## Ruang lingkup
1. Penilaian PG4/PG5, MCMA, kategori benar-salah, isian, esai dengan rubrik, bobot per paket/asesmen, skor parsial.
2. Koreksi manual esai (memakai `kf_essay_manual_grades`), antrean review, publikasi nilai, histori revisi.
3. Pusat peserta: filter SD/SMP/SMA, paket 1–12, nama/email, status dan pagination.
4. Nilai akhir latihan/tryout, progres, ekspor PDF/Excel dan notifikasi.
5. Sertifikat **per paket**, bukan otomatis untuk semua paket yang dibeli. Kelayakan setelah semua nilai final dipublikasikan dan ambang kelulusan paket terpenuhi; PDF, nomor unik, QR verifikasi, revoke/reissue.

## Prinsip kompatibilitas
- Jangan ubah perhitungan historis `kf_attempts.objective_score` (persentase 0–100), `kf_answers.auto_score`, atau hasil koreksi lama.
- Simpan versi bobot dan snapshot hasil saat publikasi; hindari double-count essay.
- Seluruh RPC/admin mutasi harus mengecek role pada server, bukan hanya UI.
- RLS: peserta hanya membaca nilainya sendiri dan sertifikat miliknya; sertifikat publik hanya menampilkan data minimal.
- Akses paket tetap berdasarkan gerbang paket berbayar saat ini.
- Jangan mengubah Question Studio, Google OAuth, pembayaran, timer tryout, dan pengaturan paket tanpa pengujian regresi.
- Perubahan skema additive/idempotent, tidak DROP/TRUNCATE/disable RLS.
- Responsif: mobile 320–767 px, tablet 768–1023 px, laptop >=1024 px; tabel menjadi kartu/scroll horizontal yang dapat diakses.

## Gate sebelum deploy
- [ ] Backup DB Supabase dan Storage terbukti berhasil dan bisa dipulihkan.
- [ ] Audit definisi tabel, kolom, fungsi RPC, RLS dan constraint aktual (jangan berasumsi).
- [ ] SQL diuji pada staging.
- [ ] Login Google, role admin, paywall, paket SD/SMP/SMA diuji.
- [ ] PG4, PG5, MCMA, kategori, isian, esai dan nilai lama diuji.
- [ ] Koreksi ulang, publikasi, revoke/reissue sertifikat diuji.
- [ ] Browser mobile/tablet/laptop dan aksesibilitas diuji.
- [ ] Merge hanya setelah persetujuan pemilik.

## Keputusan produk
- Sertifikat: **1 per peserta per paket per jenjang**, hanya jika lulus.
- Ambang nilai: default 75, dapat diubah admin.
- Paket dibeli tidak sama dengan paket lulus.
- Sertifikat lama tidak berubah diam-diam saat nilai direvisi.

## Urutan pengerjaan
1. Audit data nyata dan rancangan migrasi.
2. Skema grading versioned, RPC aman, koreksi/publikasi.
3. UI admin/peserta responsif.
4. Sertifikat dan verifikasi.
5. Uji regresi dan deployment terkendali.

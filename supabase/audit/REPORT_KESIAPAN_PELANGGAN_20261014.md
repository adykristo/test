# Audit kesiapan KlinikFisikapku V15 - 14 Oktober 2026

## Ruang lingkup dan batas pemeriksaan
Audit dilakukan pada cabang GitHub `main`, **baca-saja** pada kode produksi. Tidak ada koneksi Supabase terpasang ke ChatGPT saat penyusunan laporan; tidak ada query yang telah dijalankan pada database produksi. Domain publik tidak dapat dibuka oleh alat pemeriksaan, sehingga kecepatan riil, response HTTP, login dan UI belum diverifikasi. Tidak ada perubahan HTML/JS website, RLS, data peserta, pembayaran atau sertifikat.

## Hasil yang bisa dibuktikan dari kode
- `member/supabase-config.js` memakai publishable key (boleh ada di klien); pada 8 file penting yang dipindai tidak ditemukan literal `sb_secret_` (bukan audit keseluruhan riwayat repo).
- `member/admin.html` mengandung operasi tulis langsung ke tabel: pembatasan bergantung pada **RLS**; pengecekan role yang hanya dilakukan di UI tidak cukup.
- `member/supabase-publisher-v15.js` menulis ke `kf_packages`/`kf_questions` lewat klien; **RLS per operasi** wajib ditegakkan.
- `member/supabase-data-v15.js` mengakses `kf_start_attempt`, `kf_attempt_questions`, `kf_save_answer`, `kf_submit_attempt_v13`; otorisasi paket/attempt harus dijamin oleh server RPC.
- Halaman peserta masih memakai `kf_issue_eligible_certificates` untuk status sertifikat; pastikan definisi yang **aktif** di Supabase hanya menerbitkan sertifikat berdasarkan nilai resmi berbobot, bukan skor sementara.
- Halaman Admin dan aplikasi peserta mendukung login password; ini sesuai kondisi **rollback yang diminta pemilik**, jangan mengubahnya tanpa persetujuan.
- Workflow `.github/workflows/backup-supabase.yml` mencakup backup database `pg_dump`, enkripsi, dan upload Google Drive. Backup Supabase Storage dan **restore percobaan** belum terbukti.
- Form permintaan pembayaran manual dan approval admin perlu uji akun silang dan duplikasi.

## Prioritas dan kriteria lulus
1. **P0 - RLS, grants, fungsi admin, akses berbayar:** jalankan `supabase/audit/READ_ONLY_PRODUCTION_SECURITY_FULL_20261014.sql`; setiap FAIL harus diperiksa. Audit isi SECURITY DEFINER RPC, bukan hanya privilege. Uji akun peserta A tidak bisa baca/kirim akses peserta B, serta peserta tanpa pembelian tidak dapat mengambil konten melalui RPC/API.
2. **P0 - pembayaran:** uji order pending tidak mengaktifkan paket; approve hanya role super_admin yang sah; pengulangan approval tidak memberikan akses berganda atau tagihan salah; order detail tidak bocor lintas peserta.
3. **P0 - nilai dan sertifikat:** peserta menyelesaikan PG/esai, admin memberi nilai, preview dengan bobot total 100%, admin publish, peserta membaca skor resmi; jika belum dinilai maka tidak ada sertifikat. Nilai di bawah 75 tidak terbit; yang memenuhi syarat terbit hanya sekali, token QR valid.
4. **P1 - login dan Google Apps Script:** audit izin `signInWithPassword` vs Google sebagai keputusan kebijakan. Audit `verifyAdmin_`, token/verifikasi per request, Script Properties dan pencegahan replay, tanpa mengirim kunci ke chat.
5. **P1 - backup:** verifikasi 3 backup terakhir di Drive, ukuran dan waktu, pemulihan `pg_restore` di **database uji terpisah**, backup Storage private dan retensi. Jangan menguji restore pada production.
6. **P1 - infrastruktur:** periksa HTTPS, redirect HTTP, CSP, pengaturan DNS, sertifikat dan cache. Pengaturan Cloudflare dilakukan hanya setelah memetakan GitHub Pages + DNS agar situs tidak offline.
7. **P2 - pengalaman pelanggan:** uji HP 390px, tablet 768px, laptop 1366px, ukuran halaman/performa Lighthouse, tombol dan upload PDF/gambar.

## Cara meneruskan secara aman
1. Hubungkan integrasi Supabase atau jalankan satu file read-only yang disebutkan dan kirim hasil CSV.
2. Identifikasi FAIL/CHECK faktual dari database; simpan backup sebelum rencana perubahan.
3. Perbaiki dengan SQL migrasi yang spesifik, diverifikasi lebih dulu di staging, tanpa menjalankan ulang paket SQL hardening besar secara membabi buta.
4. Uji akun lintas role dan pembayaran percobaan sebelum menyatakan siap pelanggan.

**Status keputusan:** NOT READY VERIFIED. Belum ada hasil live RLS, pengujian pembayaran end-to-end atau uji restore. Ini bukan bukti bahwa website tidak aman; berarti jaminan keamanannya belum cukup teruji.

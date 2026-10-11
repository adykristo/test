# V15 — rencana cutover sertifikat satu sumber (belum untuk produksi)

Temuan dari CSV (53):
- `kf_certificate_status()`: memakai nilai terbaik objektif `kf_attempts.objective_score >70`, hanya assessment terlihat, syarat latihan + tryout wajib ada.
- `kf_issue_eligible_certificates()`: otomatis dipanggil oleh dashboard saat melihat riwayat, menyimpan ke `kf_certificates` dengan UNIQUE(user_id,member_package_id).
- `kf_my_certificates()`: membaca sertifikat milik `auth.uid()`.
- Ada 4 sertifikat lama, 0 pada tabel `kf_v15_package_certificates`. **Jangan hapus keempat sertifikat ini.**

## Keputusan
- Tetap gunakan `kf_certificates` sebagai sumber sertifikat, tidak menerbitkan entri baru ke tabel alternatif.
- Kode draft `DRAFT_v15_legacy_certificate_cutover.sql` mengganti implementasi V1 dengan syarat semua assessment aktif (latihan dan tryout) harus memiliki hasil resmi V15 yang sudah diterbitkan dan mencapai ambang (default 75 atau kebijakan).
- Kode draft `DRAFT_v15_legacy_certificate_verification_bridge.sql` menambahkan token ke sertifikat lama tanpa mengubah isi entri lama. Jalankan **bridge lebih dulu**, barulah cutover issuer. Token dipakai di `sertifikat-cetak-v15.html` dan `verifikasi-sertifikat-v15.html`.
- Halaman peserta `hasil-nilai-v15.html` membaca RPC milik pengguna sendiri dan memberikan tombol cetak PDF + QR untuk sertifikat yang sudah memiliki token.
- Persyaratan PDF terverifikasi tidak sama dengan bukti kelulusan seluruh program: pastikan pemetaan `kf_package_access` benar dan tidak dapat meloloskan paket kosong.
- Ambang kelulusan dapat disimpan di `kf_v15_grading_policies.passing_score`; antarmuka admin untuk mengubahnya masih perlu pengujian dan perampungan.

## Penghalang rilis
1. Backup terenkripsi sudah ada, tapi restore ke staging belum terverifikasi.
2. SQL cutover dan bridge **belum** dipasang atau diuji di staging/produksi.
3. Pengujian sesi admin, peserta biasa, dan akses lintas akun belum dilakukan.
4. Perlu cek penilaian dan penerbitan end-to-end dengan data uji, termasuk percobaan ulang, esai tertunda, dan skenario 4 sertifikat lama.
5. Uji cetak dan QR fisik di Chrome HP/tablet/laptop; audit aksesibilitas.
6. Pastikan kebijakan nilai admin versi terbaru tidak memberi sertifikat keliru pada attempt sejarah.

## Urutan pemasangan (hanya setelah staging tersedia)
1. Pulihkan backup ke staging, catat checksum dan bandingkan jumlah peserta, pengerjaan, sertifikat.
2. Jalankan migrasi grading/publikasi dan bridge verifikasi pada staging; verifikasi tabel dan privileges.
3. Jalankan cutover issuer lama → aturan resmi 75 pada staging.
4. Uji akun peserta dengan nilai PG=0/esai=10 dari 10, bobot 40:60 → skor resmi 60 → **tidak lulus sertifikat**.
5. Uji nilai lulus 75 ke atas untuk **semua** latihan dan tryout satu paket → tepat satu sertifikat; panggil ulang → tetap satu.
6. Uji 4 sertifikat historis tetap bisa dibaca/unduh dan memperoleh QR; peserta lain harus ditolak.
7. Uji callback Google, pembayaran, RLS, paket, Question Studio dan timer tryout.
8. Baru tinjau merge PR #18; siapkan rollback migrasi terpisah. Jangan gunakan rollback GitHub untuk memulihkan database.

Status PR #18 tetap Draft. Tidak ada perintah untuk auto-merge atau produksi.

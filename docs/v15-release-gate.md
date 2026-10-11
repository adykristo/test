# Release Gate — Sistem Penilaian dan Sertifikat V15

## Status saat ini
PR #18 adalah **DRAFT**. Jangan merge/deploy sampai persyaratan di bawah terpenuhi.
Kode yang selesai pada cabang: weighted calculator + tests, admin attempt listing, admin preview RPC, admin publishing RPC, official-score owner RPC, responsive admin/participant views, read-only certificate readiness, token verifier page/RPC draft, read-only reporting CSV. `kf_certificates` dan legacy PDF cetak tetap digunakan; **belum ada issuer V15 baru yang aman**.

## Uji praproduksi (akun dan data dummy)
- [ ] Tes pemulihan backup Supabase dengan database staging, termasuk Storage yang terpakai.
- [ ] Jalankan migrasi DRAFT satu per satu di staging, bandingkan checksum definisi RPC produksi dengan draft.
- [ ] Dengan akun super_admin Google, list attempts dan pratinjau bobot PG4 40/Esai 60 memperoleh 60.00 untuk dua attempt contoh. Nilai objektif asli tetap sama.
- [ ] Dengan akun peserta Google, semua RPC `kf_admin_*` ditolak `42501`; tidak dapat mengambil nilai/sertifikat orang lain.
- [ ] Uji publikasi pertama, publikasi identik (idempotent), revisi nilai, kebijakan bobot versi baru, dan perubahan nilai sesudah preview (harus ditolak).
- [ ] Uji PG4, PG5, MCMA partial, kategori partial, isian, esai menunggu koreksi, seluruh jenjang SD/SMP/SMA.
- [ ] Audit nyata fungsi legacy `kf_issue_eligible_certificates`, `kf_certificate_status`, `kf_my_certificates`: kelulusan lama >70 **berbeda** dari ambang baru default 75. Keputusan harmonisasi dibutuhkan.
- [ ] Audit bahwa satu paket anggota `member_packages.id` bisa berisi banyak asesmen, dan seluruh persyaratan paket terpenuhi sebelum sertifikat diterbitkan.
- [ ] Jangan aktifkan auto-issue tabel `kf_v15_package_certificates` sebelum aturan sertifikat lama dipetakan agar tidak terbit ganda.
- [ ] PDF sertifikat asli berhasil dicetak dari dashboard; verifikasi QR hanya setelah token benar-benar diterbitkan.
- [ ] Uji responsif 360px, 768px, 1024px, 1440px; teks/tabel tidak terpotong; navigasi dapat diakses keyboard.
- [ ] Uji ulang login Google, aktivasi admin, paket berbayar, latihan, timer tryout, bank soal, koreksi esai, dan modul.
- [ ] Semua GitHub Actions CI lulus serta review PR sebelum merge; simpan langkah rollback GitHub+Supabase terpisah.

## Masalah yang tetap memblokir rilis
1. Belum ada bukti berhasilnya **restore backup**, meski backup terenkripsi sudah ada.
2. Source SQL fungsi penerbit sertifikat lama belum tersedia di git branch, sehingga tidak boleh diganti/diikat otomatis.
3. Pengujian browser nyata menggunakan akun super_admin/akun peserta belum dilakukan.
4. Tidak ada bukti nilai publikasi end-to-end dan integritas sertifikat setelah revisi.

## SQL inspeksi penerbit lama
Lihat `supabase/audit/READ_ONLY_legacy_certificate_functions.sql`. Hanya jalankan read-only audit; periksa secret literal sebelum membagikan hasil.

Prinsip: baseline `baseline-v15-2026-10-11` dan produksi dijaga; PR #18 tetap draft.

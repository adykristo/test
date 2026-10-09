# Migrasi Google-only — rencana aman KlinikFisikapku

**Status (2026-10-09):** UI Google-only peserta dan onboarding biodata sudah disiapkan di cabang pengujian PR #3, belum di-merge dan belum diuji end-to-end dengan Supabase TEST. Monitoring akun ditolak disembunyikan di cabang ini. Admin login dan pembatasan server-side belum diubah.

## Kenapa tidak langsung mematikan email/password?
- UI `member/index.html` pada cabang ini sudah menggunakan tombol Google untuk daftar dan masuk. **Fungsi JavaScript legacy** `api("daftar")`/`auth.signUp` dan `api("login")`/`signInWithPassword` masih tersedia di balik layar, sehingga **belum Google-only secara keamanan**.
- `member/supabase-auth.js` sekarang menampilkan onboarding jika profil hasil trigger ada tetapi biodata belum lengkap; tetap menolak jika profil tidak terbaca, dihapus, atau ditolak. RLS untuk update biodata **belum diverifikasi**, jadi belum dapat diklaim pendaftaran baru berhasil.
- Peserta lama mungkin memiliki ownership paket/progres yang terikat `auth.users.id`. Membuat user Google baru berpotensi menghasilkan ID berbeda. **Jangan migrasi dengan mencocokkan email saja.**
- Admin memakai `is_member_admin` sebagai pemeriksaan otorisasi; pemeriksaan ini harus dipertahankan.

## Urutan aman
1. Jalankan `member/sql/AUDIT-GOOGLE-ONLY-READONLY.sql` di Supabase. Catat agregat tanpa mengirim identitas peserta.
2. Audit trigger pembuat profil `auth.users`, kebijakan insert/update `member_profiles`, constraint username dan RPC pendaftaran.
3. Bangun onboarding Google baru yang hanya mengizinkan akun Google terverifikasi melengkapi biodata, tanpa akses berbayar sampai admin menyetujui. Gunakan `auth.uid()` di server dan jangan menerima user_id dari browser.
4. Uji peserta baru, peserta lama, admin, penolakan, dan transaksi dengan proyek TEST; pastikan ID auth lama tetap sama setelah identity linking.
5. Migrasikan peserta lama melalui `auth.linkIdentity({provider:"google"})` dari sesi akun mereka sendiri, verifikasi hasil di `auth.identities`; jangan membuat ulang profil, ownership atau progress.
6. Setelah seluruh akun lama siap dan alur baru diuji, ubah UI peserta/admin ke tombol Google saja, lalu nonaktifkan pendaftaran password baru di sisi server dengan pengaturan Supabase yang sesuai. Jangan menghapus Email Provider tanpa memastikan dampaknya terhadap peserta lama.
7. Pastikan pembatasan Google ditegakkan di sisi server (Supabase Auth/hook atau gerbang RPC dan RLS) untuk aplikasi, bukan sekadar menyembunyikan tombol. Google OAuth tetap membutuhkan pemeriksaan admin dan paket.

## Uji regresi wajib
- Google baru → profil belum lengkap → formulir biodata → pending → pilih paket → permintaan → persetujuan admin → ownership → latihan/tryout.
- Google lama terhubung → ID user, paket, progress, riwayat pembayaran tetap sama.
- Admin non-admin ditolak, admin Google aktif bisa masuk.
- Akun `ditolak` tidak masuk penghitung Monitoring; data tidak dihapus.
- Login password lama tetap tersedia selama migrasi, baru dihentikan setelah lolos semua pengujian.

**Jangan jalankan perubahan RLS atau nonaktifkan provider pada tahap ini.**

## Tahap verifikasi saat ini (tidak menyentuh produksi)
1. Buat URL preview dari cabang PR #3 atau uji di localhost; GitHub Pages default **tidak** memublikasikan branch PR otomatis. Jangan merge hanya untuk menguji.
2. Siapkan **Supabase TEST** dengan schema, trigger `handle_new_member`, RPC, dan RLS yang kompatibel. Jangan arahkan preview ke database produksi. Jangan menyalin data pribadi peserta ke TEST.
3. Konfigurasikan Google OAuth TEST (redirect URL preview, Site URL, dan kredensial OAuth yang tepat).
4. Jalankan audit read-only `member/sql/AUDIT-GOOGLE-ONBOARDING-READONLY.sql` di TEST, cek kolom dan policy update member_profiles.
5. Uji Google baru -> trigger membuat member_profiles -> formulir -> simpan -> status pending -> tidak bisa mengakses paket berbayar. Jika update ditolak RLS, hentikan dan audit kebijakan, jangan mematikan RLS.
6. Uji Google lama, akun ditolak, akun dihapus, admin non-admin, akun admin, dan akses paket. Jangan menguji pembayaran riil di TEST.
7. Baru setelah semua lulus, tinjau perubahan server-side untuk menutup API password legacy dan admin login, tanpa memutus akun lama.

**Batas verifikasi:** review kode/commit bukan uji browser atau pengujian database. Tidak ada klaim bahwa Google OAuth TEST atau pembayaran telah diuji.

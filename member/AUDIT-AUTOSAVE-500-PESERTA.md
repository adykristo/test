# Rencana penguatan jawaban KlinikFisikapku — lingkungan uji

**Status:** perencanaan, belum diaktifkan pada website produksi.
**Baseline main:** dfdbf02f202950eca57fa4da3703ded0fe544559
**Branch:** uji-autosave-500-peserta-20261009

## Hasil audit kode
- `member/supabase-data-v15.js`: `saveAnswer` memanggil RPC `kf_save_answer`; `submit` memanggil `kf_submit_attempt_v13`.
- `member/index.html`: `kfServerSaveCurrent` menunggu simpan sebelum pindah soal dan sebelum submit.
- Runner memulai `answers:{}` tanpa terlihat memuat jawaban tersimpan pada alur tersebut.
- Tidak ditemukan retry offline / autosave berkala pada runner yang diperiksa.
- SQL definisi fungsi RPC dan kondisi database aktif belum diverifikasi; **jangan mengasumsikan** keamanan/idempotensi hanya dari nama RPC.

## Gate wajib sebelum modifikasi
1. Periksa definisi SQL aktif `kf_start_attempt`, `kf_save_answer`, `kf_submit_attempt_v13`, `kf_attempt_questions` pada staging.
2. Periksa apakah `kf_start_attempt` mengembalikan attempt lama atau membuat baru; apakah ada RPC aman untuk mengambil jawaban milik peserta.
3. Periksa cara server menolak jawaban sesudah deadline / submitted dan submit duplikat.
4. Siapkan Supabase staging dengan data sintetis dan RLS yang sama; **jangan** menggunakan akun/data produksi untuk uji beban.

## Implementasi yang direncanakan (branch ini saja)
- Autosave debounce 1–2 detik, serialisasi per attempt+question agar respons lama tidak menimpa yang baru.
- Status UI: Belum tersimpan / Menyimpan / Tersimpan / Offline.
- Antrian jawaban pending di perangkat dengan key berdasarkan user+attempt; sinkron ulang saat online dan setelah login; hindari menyimpan kunci/pembahasan.
- Resume attempt dari data server, deadline server tetap berlaku.
- Tombol submit terkunci selama request; server harus idempotent dan transaksional.
- Saat deadline habis, tangani pending save tanpa menjanjikan jawaban yang server sudah tolak.

## Pengujian wajib
- Uji unit: debounce, pergantian soal cepat, request gagal, reload, offline/online, logout/login.
- Uji integrasi: PG4/PG5, MCMA, kategori, isian, esai+file; deadline, submit ganda, peserta tidak boleh baca jawaban peserta lain.
- Load test staging: 20, 50, 100, 250, 500 virtual users; ramp-up, jangan semua memakai satu akun.
- Lulus jika 100% jawaban yang **dikonfirmasi server** cocok saat dibaca ulang, tanpa akses silang, dan tidak ada hasil submit duplikat.
- Catat p95 latency, rate error, CPU/database connections, dan batas paket Supabase.

## Release & rollback
- Backup database dan Storage diverifikasi terlebih dahulu.
- Deploy preview dari branch, bukan domain produksi.
- Perubahan ke main dan SQL produksi **hanya setelah persetujuan eksplisit pengguna**.
- Rollback kode ke commit baseline bila ada regresi; pemulihan data perlu prosedur terpisah.

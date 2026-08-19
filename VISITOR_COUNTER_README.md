# Visitor Counter untuk CBT GitHub Pages

Modul `visitor-counter.js` sudah dipasang ke halaman HTML.

## Agar statistik benar-benar tercatat
Website GitHub Pages tidak menjalankan PHP/MySQL. Modul ini menggunakan GoatCounter sebagai layanan statistik ringan.

1. Buat site GoatCounter.
2. Ambil kode/site code Anda.
3. Buka `visitor-counter.js`.
4. Ganti:
   `GANTI_DENGAN_KODE_GOATCOUNTER`
   dengan kode site Anda.
5. Commit dan push ke GitHub.
6. Statistik dapat dilihat dari dashboard GoatCounter.

## Yang tercatat
- Pageview
- Halaman yang dibuka
- Waktu kunjungan
- Statistik pengunjung dari dashboard GoatCounter

Catatan: jangan menyimpan IP pengunjung sendiri di GitHub repository. Untuk CBT dengan banyak peserta, gunakan layanan analytics/backend yang memang dirancang untuk statistik.

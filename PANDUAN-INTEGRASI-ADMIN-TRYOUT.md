# Panduan Integrasi Admin Tryout KlinikFisikapku

Paket ini sudah disesuaikan dengan struktur website lama: GitHub Pages tetap
menyimpan halaman, paket soal publik, dan gambar; Google Apps Script tetap
menyimpan kunci serta menghitung nilai. Data paket lama tetap dapat dibaca.

## File yang diperbarui

- `admin-dashboard-login.html` — editor admin terpadu.
- `index.html` — halaman peserta/CBT dengan dukungan PGK.
- `code.gs` — backend kunci privat dan penskoran objektif.
- `BACA-DULU.txt` — urutan pemasangan singkat.

`admin.html` tetap berupa halaman 404. Gunakan alamat
`admin-dashboard-login.html` untuk masuk ke panel admin.

## Cara memasang ke GitHub

1. Cadangkan repository website yang sedang aktif.
2. Ekstrak ZIP ini.
3. Masuk ke folder `test-main`, pilih semua isinya, lalu upload ke root
   repository lama. Struktur akhirnya harus berisi `index.html`,
   `admin-dashboard-login.html`, dan folder `data/` di tingkat yang sama.
4. Commit perubahan, lalu tunggu GitHub Pages selesai melakukan deploy.
5. Buka `https://DOMAIN-ANDA/admin-dashboard-login.html` dan lakukan login.

File `code.gs` dan `appscripts.json` berada di luar folder `test-main` karena
keduanya dipasang di Google Apps Script, bukan dilayani oleh GitHub Pages.

## Memperbarui Google Apps Script

1. Buka Spreadsheet hasil tryout, lalu **Extensions > Apps Script**.
2. Ganti isi file skrip dengan seluruh isi `code.gs` dari paket ini.
3. Pastikan Script Property `ADMIN_KEY` tetap berisi kode rahasia admin Anda.
4. Pilih **Deploy > Manage deployments**, klik ikon edit, pilih
   **New version**, lalu **Deploy**.
5. Bila URL Web App berubah, simpan URL baru itu pada konfigurasi panel admin
   dan pada konstanta `GOOGLE_SCRIPT_URL` di `index.html`.

Sheet kunci akan otomatis memperoleh kolom tambahan untuk PGK, aturan skor,
gambar kunci, dan gambar pembahasan. Kolom lama tidak dihapus.

## Model soal yang didukung

- PG 4 opsi dan PG 5 opsi: satu jawaban benar.
- PGK MCMA: beberapa opsi dapat dipilih. Mode skor bisa tepat penuh atau
  skor sebagian tanpa pilihan salah.
- PGK kategori: setiap pernyataan diberi satu kategori, misalnya
  Benar/Salah atau Ya/Tidak/Tidak cukup data. Skor penuh, skor sebagian, dan
  ambang minimal benar dapat diatur per soal.
- Isian singkat: beberapa variasi kunci dapat dipisahkan dengan tanda `|`.
- Esai: peserta mengunggah PDF/foto dan guru mengoreksi dari panel admin.

## Format Word untuk import massal

Setiap soal dimulai dengan nomor manual. Gunakan penanda berikut persis di
awal baris. Gambar atau screenshot dapat ditempel setelah baris narasi,
opsi, pernyataan, `KUNCI:`, atau `PEMBAHASAN:` yang sesuai.

### PGK MCMA

```text
1. Sebuah benda mengalami dua gaya. Pilih semua pernyataan yang benar.
TIPE: PGK-MCMA
A. Resultan gaya dapat bernilai nol.
B. Percepatan selalu searah kecepatan.
C. Satuan gaya adalah newton.
D. Gaya merupakan besaran skalar.
KUNCI: A, C
MODE SKOR: SEBAGIAN
SKOR PENUH: 2
SKOR SEBAGIAN: 1
MINIMAL BENAR: 1
PEMBAHASAN: Gunakan Hukum II Newton.
```

### PGK kategori

```text
2. Nilai setiap pernyataan berikut.
TIPE: PGK-KATEGORI
KATEGORI: Benar | Salah | Tidak cukup data
PERNYATAAN 1: Kelajuan adalah besaran skalar.
KUNCI 1: Benar
PERNYATAAN 2: Perpindahan selalu sama dengan jarak.
KUNCI 2: Salah
PERNYATAAN 3: Arah gerak benda diketahui dari informasi yang diberikan.
KUNCI 3: Tidak cukup data
SKOR PENUH: 2
SKOR SEBAGIAN: 1
MINIMAL BENAR: 2
PEMBAHASAN: Periksa definisi setiap besaran.
```

Untuk PG biasa gunakan `TIPE: PG4` atau `TIPE: PG5`; untuk isian gunakan
`TIPE: ISIAN`; dan untuk esai gunakan `TIPE: ESAI`. Rumus boleh ditulis
sebagai LaTeX, misalnya `$F = ma$`, atau dibuat melalui **Insert > Equation**
di Word. Equation Word akan dirender menjadi gambar PNG saat import dan
diunggah bersama gambar lainnya.

## Migrasi paket lama

Paket lama tetap tampil. Agar kunci lama ikut tersimpan dengan format server
terbaru, buka paket di panel admin, cek kunci jawaban, lalu klik
**Simpan & Publish**. Setelah `code.gs` baru terpasang, editor juga dapat
mengambil kembali kunci privat ketika paket dibuka untuk diedit sehingga
kunci tidak berubah menjadi nilai default.

## Pemeriksaan setelah deploy

1. Buat paket uji berisi satu PG, satu PGK MCMA, dan satu PGK kategori.
2. Gunakan Preview sebagai Siswa dari panel admin.
3. Publish lalu kerjakan dengan nomor ujian uji coba.
4. Pastikan skor penuh dan skor sebagian sesuai pengaturan.
5. Buka kembali paket lewat Edit dan pastikan semua kunci tetap terpilih.

Jangan menaruh token GitHub atau `ADMIN_KEY` di file dokumentasi maupun JSON
publik. Gunakan konfigurasi yang sudah tersedia di panel dan Script
Properties Apps Script.

### Catatan keamanan data lama

Arsip asal masih membawa beberapa salinan paket lama di root dan di
`data/tryout/` yang mengandung `jawaban_benar`. Paket baru yang dipublish oleh
editor tidak lagi melakukan hal itu. Setelah Anda memastikan kunci paket lama
sudah masuk ke Apps Script dan paket tersebut tidak lagi dipakai, hapus salinan
legacy yang tidak tercantum pada `data/manifest-tryout.json` agar kunci lama
tidak dapat diakses melalui URL publik.

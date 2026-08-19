# Fitur Baru — Peningkatan Tryout KlinikFisikapku

## Untuk Siswa (index.html)

### 1. Tanda Ragu-Ragu (Flag)
- Tombol **⚐ Tandai Ragu** di setiap soal saat mengerjakan.
- Soal yang ditandai muncul kuning di navigator nomor + ikon ⚑.
- Tombol **Ke soal ragu** di footer untuk loncat antar soal yang masih ragu.
- Status "Ragu: N" ikut tampil di baris progres.
- Tersimpan di autosave (localStorage) — aman kalau refresh/tab tertutup.

### 2. Keyboard Shortcut
Saat fokus **bukan** di kotak isian/esai:
| Tombol | Aksi |
|--------|------|
| `A`–`E` atau `1`–`5` | Pilih opsi PG |
| `←` / `→` | Soal sebelumnya / berikutnya |
| `Enter` | Soal berikutnya |
| `F` | Toggle ragu-ragu |

### 3. Atur Ukuran Font
- Tombol **A− / A+** di toolbar soal.
- 4 tingkat: Kecil → Normal → Besar → Sangat Besar.
- Preferensi ikut tersimpan di autosave.

### 4. Legend Navigator diperjelas
Ditambah warna kuning untuk status **Ragu-ragu**.

---

## Untuk Admin (admin.html)

### 1. Duplikat Soal
- Tombol **⧉ Duplikat** di setiap kartu soal.
- Menyalin isi (teks, gambar, opsi, kunci, pembahasan) menjadi soal baru.
- Berguna untuk soal sejenis yang hanya beda angka/gambar.

### 2. Preview sebagai Siswa
- Tombol **👁 Preview sebagai Siswa** di samping "Simpan & Publish".
- Membuka modal yang menampilkan soal persis seperti yang dilihat peserta (tanpa kunci).
- Navigasi Prev/Next + keyboard `←` `→` / `Esc` untuk tutup.
- **Wajib dipakai** sebelum publish, terutama setelah import Word atau upload gambar massal.

### 3. Validasi kunci (sudah ada, tetap dipertegas)
Saat Simpan & Publish, sistem menolak paket jika:
- PG tanpa kunci jawaban
- Isian tanpa kunci
- Opsi kurang dari 2 (kecuali mode opsi otomatis)

---

## Cara Deploy
1. Upload `index.html` dan `admin.html` yang baru ke repo GitHub (ganti file lama).
2. Tidak perlu ubah Apps Script / data JSON yang sudah ada.
3. Fitur siswa aktif otomatis untuk semua tryout yang sudah ada.
4. Fitur admin aktif saat buka `admin.html` baru.

## Saran pengembangan berikutnya (belum diimplementasi)
- Bank soal (simpan soal individual, pakai ulang antar paket)
- Bobot nilai per soal
- Import dari Excel/CSV
- Kalkulator ilmiah sederhana di sisi siswa
- Mode gelap
- Warning pindah tab (anti-curang ringan)
- Resume tryout dari server (bukan hanya localStorage)

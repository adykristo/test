# Panduan Fitur Baru — Tryout KlinikFisikapku

Dua fitur ditambahkan ke `index.html` **tanpa mengubah fitur lain yang sudah ada**:

---

## 1. Nama & Nomor Peserta Harus dari Admin

Sekarang peserta **tidak bisa lagi mengetik nama sendiri**. Peserta hanya
memasukkan **Nomor Ujian**, lalu sistem mencocokkannya ke daftar resmi yang
kamu (admin) siapkan di file:

```
data/daftar-peserta.json
```

Contoh isinya (sudah dibuatkan contohnya, tinggal kamu edit/tambah data
peserta asli dan upload ke repo GitHub kamu di folder `data/`, sejajar dengan
`manifest-soal.json` dan `manifest-tryout.json` yang sudah ada):

```json
[
  {
    "noUjian": "SD001",
    "nama": "Ahmad Fauzan",
    "paket": "semua"
  },
  {
    "noUjian": "SMP101",
    "nama": "Budi Santoso",
    "paket": ["paket-smp-1"]
  }
]
```

Penjelasan field:
- **noUjian** — nomor ujian yang kamu bagikan ke peserta. Wajib unik.
- **nama** — nama lengkap peserta. Ini yang otomatis muncul, peserta tidak
  bisa mengubahnya.
- **paket** — opsional.
  - `"semua"` (atau field ini dihapus) → nomor ujian ini boleh dipakai untuk
    tryout paket apa saja.
  - `["paket-smp-1", "paket-smp-2"]` → nomor ujian ini hanya boleh dipakai
    untuk paket tryout dengan `id` tersebut (id paket bisa dilihat di
    `data/manifest-tryout.json`, field `"id"`).

**Alur di sisi peserta:**
1. Peserta klik "Mulai Tryout" pada salah satu paket.
2. Muncul halaman "Verifikasi Data Peserta" — peserta hanya mengetik Nomor
   Ujian.
3. Sistem otomatis mencari nomor tsb di `daftar-peserta.json` dan
   menampilkan nama yang cocok (read-only, tidak bisa diedit peserta).
4. Kalau nomor tidak ditemukan → muncul pesan error, tombol "Mulai Ujian"
   tetap nonaktif.
5. Kalau ditemukan tapi paket tryout tsb tidak diizinkan untuk nomor
   tersebut → muncul pesan error khusus.
6. Kalau valid → tombol "Mulai Ujian" aktif dan peserta bisa mulai.

> Catatan: karena situs ini murni statis (tanpa server/database), validasi
> ini mencegah peserta mengetik nama sembarangan, tapi bukan sistem login
> yang aman 100% (nomor ujian bisa dilihat siapa saja yang bisa mengakses
> file JSON-nya). Kalau nanti perlu keamanan lebih tinggi, harus pakai
> backend/database sungguhan.

---

## 2. Soal Tryout dalam Bentuk Gambar

Setiap soal di file `soal-<paket>.json` (yang direferensikan oleh
`data/manifest-tryout.json`) sekarang boleh punya field tambahan `"gambar"`:

```json
{
  "id": "soal-01",
  "pertanyaan": "Perhatikan gambar rangkaian berikut. Berapakah arus total?",
  "gambar": "https://raw.githubusercontent.com/USERNAME/REPO/main/gambar-soal/soal-01.png",
  "pilihan": {
    "A": "1 A",
    "B": "2 A",
    "C": "3 A",
    "D": "4 A"
  },
  "jawaban_benar": "B",
  "pembahasan": "..."
}
```

- Field `pertanyaan` boleh dikosongkan / diisi instruksi singkat kalau soal
  sepenuhnya berupa gambar (misalnya hasil scan soal fisika).
- Field `gambar` diisi URL gambar (bisa upload ke folder repo GitHub kamu,
  lalu pakai link raw githubusercontent, sama seperti pola `soalImage` yang
  sudah dipakai di soal latihan biasa).
- Gambar otomatis tampil di bawah teks soal, baik saat mengerjakan maupun
  saat melihat pembahasan/review setelah submit.
- Ini tidak mengganggu soal lama yang belum punya field `gambar` — soal lama
  tetap tampil seperti biasa.

---

## Yang Perlu Kamu Lakukan di Repo GitHub

1. Upload file `index.html` baru ini menggantikan yang lama.
2. Buat/upload file `data/daftar-peserta.json` (contoh sudah disediakan),
   lalu isi dengan nomor ujian + nama peserta asli.
3. Untuk soal bergambar, upload gambar ke repo (misalnya folder
   `tryout-gambar/`), lalu tambahkan field `"gambar"` di file JSON soal
   tryout terkait dengan link raw githubusercontent ke gambar tsb.

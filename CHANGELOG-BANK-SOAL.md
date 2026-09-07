# Integrasi Bank Soal Tryout v7 ke KlinikFisikapku Admin

## Yang dirombak

### `admin-dashboard-login.html`
1. **Menu sidebar baru: Bank Soal**
   - Daftar & Filter (jenjang SD/SMP/SMA + tipe + pencarian)
   - Editor Soal (semua tipe v7: PG4/PG5, PGK MCMA, PGK Kategori, Isian, Esai)
   - Import Word / JSON (format Bank Soal Tryout GitHub v7 + format React BankApp)
   - Simulasi CBT (skor objektif di browser)

2. **Penyimpanan bank lengkap**
   - `simpanSoalKeBank` sekarang menyimpan field PGK penuh: `scoring_mode`, `max_points`, `partial_points`, `partial_threshold`, `category_labels`, `statements`, gambar kunci/pembahasan, multi-kunci MCMA.

3. **Picker "Dari Bank Soal" di editor paket**
   - Filter jenjang ditambahkan (selain filter tipe & pencarian).

4. **Kompatibilitas format**
   - Export/Import JSON mendukung struktur Klinik (`{soal:...}`) dan struktur BankApp React v7 (`type`, `prompt`, `educationLevel`, dll.) dengan konversi otomatis.

## Cara pakai singkat
1. Upload `admin-dashboard-login.html` (dan `index.html` jika diganti) ke root repo GitHub Pages.
2. Login admin → isi token GitHub di **Admin Tryout → Koneksi GitHub**.
3. Buka **Bank Soal** di sidebar:
   - Buat soal di Editor, atau Import Word/JSON
   - Filter jenjang/tipe, edit/duplikat/hapus
   - Kirim soal ke paket tryout lewat tombol **→ Paket**
   - Uji dengan **Simulasi CBT**
4. Saat membuat paket tryout, gunakan kartu **Dari Bank Soal** untuk memilih soal yang sudah ada.

## Catatan
- Data bank tetap di `data/bank-soal.json` (privat lewat token admin; file JSON di repo).
- Penskoran ujian resmi tetap di Google Apps Script; simulasi CBT hanya untuk uji lokal di panel admin.
- Fitur tryout lama (PGK, Word equation → PNG, publish, peserta, hasil) tidak dihapus.

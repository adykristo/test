# Panduan Studio Soal AI KlinikFisikapku

Studio yang sama tersedia di **Soal Latihan** dan **Tryout Mingguan**.

## Kemampuan

- Input manual: PG4, PG5, MCMA, kategori, isian, dan esai.
- Template Word otomatis 1–50 soal untuk setiap tipe.
- Impor `.docx`, `.pdf` berbasis teks, dan `.txt`.
- Konversi rumus Word Equation menjadi LaTeX.
- Baca gambar dari Word serta gambar yang ditempel melalui clipboard.
- Gemini menerjemahkan, memvalidasi konsep/perhitungan/satuan, membuat kunci dan pembahasan, membuat variasi, dan menyiapkan SVG diagram sederhana.
- Asisten cepat: variasi soal, solusi, analisis OSN, dan audit kualitas.
- Semua hasil AI tampil sebagai draf. Admin dapat mengubah atau menghapus soal sebelum menekan **Simpan semua draf**.

## Aktivasi server Gemini

Jalankan pembaruan `supabase-setup.sql`, lalu dari folder proyek Supabase:

```bash
supabase secrets set GEMINI_API_KEY=ISI_API_KEY_ANDA
supabase secrets set GEMINI_MODEL=ISI_NAMA_MODEL_GEMINI
supabase functions deploy gemini-question-studio
```

Nama model sengaja dapat diatur melalui Secret agar mudah diganti tanpa mengedit HTML. Jangan meletakkan API key pada `admin.html`, `supabase-config.js`, atau GitHub.

## Format Word

```text
1. Sebuah benda bergerak dengan kecepatan ...
TIPE: PG4
A. ...
B. ...
C. ...
D. ...
KUNCI: B
PEMBAHASAN: ...
```

Untuk MCMA gunakan `TIPE: MCMA` dan contoh kunci `KUNCI: A,C`. Untuk kategori gunakan `TIPE: KATEGORI`, `KATEGORI: Benar | Salah`, kemudian `P1. ...`, `P2. ...`, dan kunci berurutan.

## Pemeriksaan sebelum publikasi

1. Pastikan angka pada soal sama dengan pembahasan.
2. Periksa satuan, pembulatan, asumsi, diagram, dan kunci.
3. Pastikan PG biasa hanya memiliki satu jawaban benar.
4. Pastikan MCMA menjelaskan bahwa jawaban dapat lebih dari satu.
5. Uji melalui tombol **Preview**.
6. Baru tampilkan konten kepada peserta.

AI membantu penyusunan, tetapi pemeriksaan akhir tetap dilakukan pengajar.

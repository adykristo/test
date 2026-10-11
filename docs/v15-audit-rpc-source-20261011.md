# Audit isi enam RPC V15 — 11 Oktober 2026
Sumber: ekspor SQL pengguna (49), diperiksa dari `pg_get_functiondef`. Tidak memodifikasi fungsi produksi.

## Temuan terkonfirmasi
- `kf_admin_grade_essay_v15`: validasi `auth.uid()` dan `member_admins.active=true, role='super_admin'`; skor 0..max; hanya jawaban esai dari attempt submitted; upsert satu nilai per answer.
- `kf_admin_list_essay_v15`: validasi super_admin; join jawaban-attempt-soal, left join manual grades; hanya submitted essay.
- `kf_get_final_score_v15`: owner check `kf_attempts.user_id=auth.uid()`, status submitted; nilai objektif persentase dikonversi proporsional menurut jumlah soal objektif; esai dirata-rata dengan jumlah soal; nilai final null selama ada esai belum dinilai. **Belum bobot per jenis soal dan belum publikasi.**
- `kf_is_admin`: validasi super_admin aktif.
- `kf_submit_attempt_v13`: wrapper owner check dan row lock, memastikan status in_progress, mendelegasikan ke `kf_submit_attempt_v13_core`.
- `kf_submit_attempt_v13_core`: objective_score 0..100, `auto_score` setiap soal objektif 0..1; MCMA mendukung exact dan partial penalti opsi salah; kategori partial per pernyataan; esai tidak di-auto-grade.

## Risiko/desain integrasi
- `kf_get_final_score_v15` **bukan** persetujuan publikasi, jangan jadikan sertifikat terbit otomatis hanya karena fungsi menampilkan status graded.
- `kf_attempts.objective_score` adalah agregat objektif, bukan rata-rata berbobot jenis soal. Untuk bobot jenis soal, hitung dari `kf_answers.auto_score` per jenis dengan filter `kf_questions.type`, lalu gabungkan manual essay `score/max_score`; hanya attempt `submitted` yang boleh diproses.
- Perlu menolak publikasi jika ada jawaban objective kosong/skor null atau essay belum dikoreksi. `kf_submit_attempt_v13_core` menulis baris skor untuk setiap soal sehingga dapat divalidasi.
- Validasi jumlah weights aktif 100%, rentang tiap bobot, assessment_key/paket, serta kepemilikan user oleh attempt dilakukan **di server RPC**, bukan JS saja.
- Harus mendefinisikan versioned policies / histori perubahan dan larangan duplikasi result, serta validasi sertifikat sesuai jenjang dan package_no.
- Fungsi lama memakai search_path public; jangan mengubah spontan pada produksi (uji perubahan terpisah).
- Enam fungsi yang sudah diaudit tidak menampilkan literal kredensial; audit hanya fungsi tersebut.

## Tahap selanjutnya
Buat RPC baru yang bersifat additive untuk **preview admin saja** dan tidak mengubah nilai, lalu uji terhadap data dummy. Publikasi resmi dan sertifikat menyusul setelah audit tabel paket, nama kolom jenjang/nomor paket dan hak akses admin.

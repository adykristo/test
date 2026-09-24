// supabase-admin.js
(function () {
  if (!window.KF_SUPABASE_CONFIG) {
    console.error("Konfigurasi Supabase tidak ditemukan.");
    return;
  }

  const supabase = window.supabase.createClient(
    window.KF_SUPABASE_CONFIG.url,
    window.KF_SUPABASE_CONFIG.anonKey
  );

  window.KFSupabaseAdmin = {
    configured: true,
    
    // Verifikasi apakah user saat ini login dan memiliki akses Super Admin
    ensureAdmin: async function () {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "../admin-dashboard-login.html";
        return false;
      }
      
      const { data, error } = await supabase
        .from('member_admins')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
        
      if (error || !data || data.role !== 'super_admin') {
        alert("Akses ditolak: Hanya Super Admin yang dapat mengakses halaman ini.");
        window.location.href = "../admin-dashboard-login.html";
        return false;
      }
      return true;
    },

    // Router API Pengganti Apps Script
    api: async function (action, payload) {
      switch (action) {
        case "adminLogin":
          // Login admin ditangani di halaman utama, ini hanya pengecekan ulang
          return { ok: true };

        case "adminListMember":
          // Memanggil fungsi SQL untuk mendapatkan data member bertopeng (masked)[cite: 11]
          const { data: members, error: errMembers } = await supabase.rpc('admin_list_members_masked');
          if (errMembers) throw errMembers;
          return { ok: true, data: members };

        case "adminVerifikasi":
          // Memperbarui tahap_terbuka dan masa aktif paket[cite: 11]
          const { error: errVerif } = await supabase.rpc('admin_update_member', {
            p_id: payload.id,
            p_action: 'activate',
            p_package: payload.paket
          });
          if (errVerif) throw errVerif;
          return { ok: true };

        case "adminTolak":
          const { error: errTolak } = await supabase.rpc('admin_update_member', {
            p_id: payload.id,
            p_action: 'reject',
            p_note: payload.catatan || ''
          });
          if (errTolak) throw errTolak;
          return { ok: true };

        case "adminNonaktifkan":
          const { error: errNonaktif } = await supabase.rpc('admin_update_member', {
            p_id: payload.id,
            p_action: 'deactivate'
          });
          if (errNonaktif) throw errNonaktif;
          return { ok: true };

        case "adminAktifkanKembali":
          const { error: errAktifKembali } = await supabase.rpc('admin_update_member', {
            p_id: payload.id,
            p_action: 'reactivate'
          });
          if (errAktifKembali) throw errAktifKembali;
          return { ok: true };

        case "adminHapusMember":
          const { error: errHapus } = await supabase.rpc('admin_update_member', {
            p_id: payload.id,
            p_action: 'soft_delete'
          });
          if (errHapus) throw errHapus;
          return { ok: true };

        case "adminListPaket":
          const { data: paket, error: errPaket } = await supabase
            .from('member_packages')
            .select('*')
            .order('created_at', { ascending: true });
          if (errPaket) throw errPaket;
          // Map snake_case to camelCase for frontend[cite: 12]
          return { 
            ok: true, 
            data: paket.map(p => ({
              nama: p.nama,
              durasiHari: p.durasi_hari,
              harga: p.harga,
              deskripsi: p.deskripsi,
              aktif: p.aktif
            }))
          };

        case "adminSimpanPaket":
          const { error: errSimpanPaket } = await supabase
            .from('member_packages')
            .upsert({
              nama: payload.item.nama,
              durasi_hari: Number(payload.item.durasiHari),
              harga: Number(payload.item.harga),
              deskripsi: payload.item.deskripsi,
              aktif: true
            }, { onConflict: 'nama' });
          if (errSimpanPaket) throw errSimpanPaket;
          return { ok: true };

        case "adminGetPaymentSettings":
          // Menyimpan konfigurasi pembayaran pada tabel paket sebagai trik tanpa tabel baru[cite: 12]
          const { data: payData } = await supabase
            .from('member_packages')
            .select('deskripsi')
            .eq('nama', '_PAYMENT_CONFIG_')
            .single();
          const config = payData ? JSON.parse(payData.deskripsi || "{}") : {};
          return { ok: true, data: config };

        case "adminSavePaymentSettings":
          const strConfig = JSON.stringify(payload.item);
          const { error: errPaySave } = await supabase
            .from('member_packages')
            .upsert({
              nama: '_PAYMENT_CONFIG_',
              durasi_hari: 0,
              harga: 0,
              deskripsi: strConfig,
              aktif: false
            }, { onConflict: 'nama' });
          if (errPaySave) throw errPaySave;
          return { ok: true };

        case "adminListKonten":
          const { data: konten, error: errKonten } = await supabase
            .from('member_content')
            .select('*')
            .order('created_at', { ascending: false });
          if (errKonten) throw errKonten;
          // Ekstrak properti JSONB 'data' agar sejajar untuk HTML frontend[cite: 12]
          const formattedKonten = konten.map(k => ({
            id: k.id,
            jenjang: k.jenjang,
            jenis: k.jenis,
            tujuan: k.tujuan,
            topik: k.topik,
            judul: k.judul,
            visible: k.visible,
            created_at: k.created_at,
            ...k.data 
          }));
          return { ok: true, data: formattedKonten };

        case "adminSimpanKonten":
          const i = payload.item;
          const contentData = {
            pdfUrl: i.pdfUrl,
            youtube: i.youtube,
            soal: i.soal,
            opsi: i.opsi,
            kunci: i.kunci,
            pembahasan: i.pembahasan,
            gambar: i.gambar,
            tipe: i.tipe,
            statements: i.statements,
            category_labels: i.category_labels,
            learning_stage: i.learning_stage || 1 // Support Tahap Belajar[cite: 11]
          };
          // Hapus atribut yang undefined/null
          Object.keys(contentData).forEach(key => contentData[key] === undefined && delete contentData[key]);

          const row = {
            jenjang: i.jenjang,
            jenis: i.jenis,
            tujuan: i.tujuan || (i.jenis === 'tryout' ? 'tryout' : 'latihan'),
            topik: i.topik,
            judul: i.judul,
            visible: i.visible !== false,
            data: contentData
          };
          if (i.id) row.id = i.id;

          const { error: errSimpanKonten } = await supabase
            .from('member_content')
            .upsert(row);
          if (errSimpanKonten) throw errSimpanKonten;
          return { ok: true };

        case "adminHapusKonten":
          const { error: errHapusKonten } = await supabase
            .from('member_content')
            .delete()
            .eq('id', payload.id);
          if (errHapusKonten) throw errHapusKonten;
          return { ok: true };

        case "adminReports":
          // Mengambil log aktivitas admin
          const { data: logs } = await supabase
            .from('member_admin_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(15);
          return { ok: true, data: { logs: logs || [] } };

        // Integrasi Edge Functions AI Gemini[cite: 12]
        case "adminRapikanSoalGemini":
        case "adminAnalisisWordGemini":
        case "adminBuatSoalGemini":
        case "adminAsistenSoal":
          const { data: aiData, error: aiError } = await supabase.functions.invoke('gemini-question-studio', {
            body: { action: action, ...payload }
          });
          if (aiError) throw new Error(aiError.message || "Gagal menghubungi server AI.");
          if (!aiData.ok) throw new Error(aiData.error || "Gagal memproses AI.");
          return aiData;

        default:
          throw new Error("Aksi admin tidak dikenali: " + action);
      }
    }
  };

  // Logout Khusus
  window.KFLogoutAdminMember = async function() {
    await supabase.auth.signOut();
    window.location.href = "../admin-dashboard-login.html";
  };
})();
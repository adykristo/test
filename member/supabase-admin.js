// supabase-admin.js — Admin Member Area KlinikFisikapku (Tahap Belajar 12 Bulan)
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

    ensureAdmin: async function () {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "../admin-dashboard-login.html";
        return false;
      }

      const { data, error } = await supabase
        .from("member_admins")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (error || !data || data.role !== "super_admin") {
        alert("Akses ditolak: Hanya Super Admin yang dapat mengakses halaman ini.");
        window.location.href = "../admin-dashboard-login.html";
        return false;
      }
      return true;
    },

    api: async function (action, payload) {
      payload = payload || {};
      switch (action) {
        case "adminLogin":
          return { ok: true };

        case "adminListMember": {
          const { data: members, error: errMembers } = await supabase.rpc("admin_list_members_masked");
          if (errMembers) throw errMembers;
          return { ok: true, data: members || [] };
        }

        case "adminVerifikasi": {
          const { error: errVerif } = await supabase.rpc("admin_update_member", {
            p_id: payload.id,
            p_action: "activate",
            p_package: payload.paket || "",
            p_note: payload.catatan || ""
          });
          if (errVerif) throw errVerif;
          return { ok: true };
        }

        case "adminTolak": {
          const { error: errTolak } = await supabase.rpc("admin_update_member", {
            p_id: payload.id,
            p_action: "reject",
            p_note: payload.catatan || ""
          });
          if (errTolak) throw errTolak;
          return { ok: true };
        }

        case "adminNonaktifkan": {
          const { error: errNonaktif } = await supabase.rpc("admin_update_member", {
            p_id: payload.id,
            p_action: "deactivate",
            p_note: payload.catatan || ""
          });
          if (errNonaktif) throw errNonaktif;
          return { ok: true };
        }

        case "adminAktifkanKembali": {
          const { error: errAktif } = await supabase.rpc("admin_update_member", {
            p_id: payload.id,
            p_action: "reactivate",
            p_note: payload.catatan || ""
          });
          if (errAktif) throw errAktif;
          return { ok: true };
        }

        case "adminHapusMember": {
          const { error: errHapus } = await supabase.rpc("admin_update_member", {
            p_id: payload.id,
            p_action: "soft_delete",
            p_note: payload.catatan || ""
          });
          if (errHapus) throw errHapus;
          return { ok: true };
        }

        case "adminSetTahap": {
          const tahap = Math.max(0, Math.min(12, Number(payload.tahap) || 0));
          const { error: errTahap } = await supabase.rpc("admin_set_member_tahap", {
            p_id: payload.id,
            p_tahap: tahap
          });
          if (errTahap) throw errTahap;
          return { ok: true };
        }

        case "adminListPaket": {
          const { data: paket, error: errPaket } = await supabase
            .from("member_packages")
            .select("*")
            .order("created_at", { ascending: true });
          if (errPaket) throw errPaket;
          const list = (paket || []).filter(function (p) { return p.nama !== "_PAYMENT_CONFIG_"; });
          return {
            ok: true,
            data: list.map(function (p) {
              return {
                nama: p.nama,
                durasiHari: p.durasi_hari,
                harga: p.harga,
                deskripsi: p.deskripsi,
                aktif: p.aktif
              };
            })
          };
        }

        case "adminSimpanPaket": {
          const item = payload.item || {};
          const { error: errSimpanPaket } = await supabase.from("member_packages").upsert(
            {
              nama: item.nama,
              durasi_hari: Number(item.durasiHari),
              harga: Number(item.harga),
              deskripsi: item.deskripsi || "",
              aktif: item.aktif !== false
            },
            { onConflict: "nama" }
          );
          if (errSimpanPaket) throw errSimpanPaket;
          return { ok: true };
        }

        case "adminGetPaymentSettings": {
          const { data: payData } = await supabase
            .from("member_packages")
            .select("deskripsi")
            .eq("nama", "_PAYMENT_CONFIG_")
            .maybeSingle();
          let item = { bank: "", nomorRekening: "", pemilikRekening: "", whatsapp: "" };
          if (payData && payData.deskripsi) {
            try {
              item = Object.assign(item, JSON.parse(payData.deskripsi));
            } catch (e) {}
          }
          return { ok: true, data: item };
        }

        case "adminSavePaymentSettings": {
          const item = payload.item || {};
          const deskripsi = JSON.stringify({
            bank: item.bank || "",
            nomorRekening: item.nomorRekening || "",
            pemilikRekening: item.pemilikRekening || "",
            whatsapp: item.whatsapp || ""
          });
          const { error: errPay } = await supabase.from("member_packages").upsert(
            {
              nama: "_PAYMENT_CONFIG_",
              durasi_hari: 0,
              harga: 0,
              deskripsi: deskripsi,
              aktif: false
            },
            { onConflict: "nama" }
          );
          if (errPay) throw errPay;
          return { ok: true };
        }

        case "adminListKonten": {
          const { data: konten, error: errKonten } = await supabase
            .from("member_content")
            .select("*")
            .order("created_at", { ascending: false });
          if (errKonten) throw errKonten;
          const formatted = (konten || []).map(function (k) {
            var data = k.data && typeof k.data === "object" ? k.data : {};
            return Object.assign(
              {
                id: k.id,
                jenjang: k.jenjang,
                jenis: k.jenis,
                tujuan: k.tujuan,
                topik: k.topik,
                judul: k.judul,
                visible: k.visible,
                created_at: k.created_at
              },
              data
            );
          });
          return { ok: true, data: formatted };
        }

        case "adminSimpanKonten": {
          const i = payload.item || {};
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
            learning_stage: Number(i.learning_stage) || 1,
            paket: i.paket,
            tanggal: i.tanggal,
            catatan: i.catatan,
            packages: i.packages,
            rubrik: i.rubrik
          };
          Object.keys(contentData).forEach(function (key) {
            if (contentData[key] === undefined || contentData[key] === null) delete contentData[key];
          });

          const row = {
            jenjang: i.jenjang,
            jenis: i.jenis,
            tujuan: i.tujuan || (i.jenis === "tryout" ? "tryout" : "latihan"),
            topik: i.topik,
            judul: i.judul,
            visible: i.visible !== false && i.visible !== "FALSE",
            data: contentData
          };
          if (i.id) row.id = i.id;

          const { error: errSimpanKonten } = await supabase.from("member_content").upsert(row);
          if (errSimpanKonten) throw errSimpanKonten;
          return { ok: true };
        }

        case "adminHapusKonten": {
          const { error: errHapusKonten } = await supabase
            .from("member_content")
            .delete()
            .eq("id", payload.id);
          if (errHapusKonten) throw errHapusKonten;
          return { ok: true };
        }

        case "adminReports": {
          const { data: logs } = await supabase
            .from("member_admin_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(30);
          return { ok: true, data: { logs: logs || [] } };
        }

        case "adminRapikanSoalGemini":
        case "adminAnalisisWordGemini":
        case "adminBuatSoalGemini":
        case "adminAsistenSoal": {
          const { data: aiData, error: aiError } = await supabase.functions.invoke(
            "gemini-question-studio",
            { body: Object.assign({ action: action }, payload) }
          );
          if (aiError) throw new Error(aiError.message || "Gagal menghubungi server AI.");
          if (aiData && aiData.ok === false) throw new Error(aiData.error || "Gagal memproses AI.");
          return aiData || { ok: true };
        }

        default:
          throw new Error("Aksi admin tidak dikenali: " + action);
      }
    }
  };

  window.KFLogoutAdminMember = async function () {
    await supabase.auth.signOut();
    window.location.href = "../admin-dashboard-login.html";
  };
})();

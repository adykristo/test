// supabase-auth.js — Member Area KlinikFisikapku (Tahap Belajar 12 Bulan)
(function () {
  if (!window.KF_SUPABASE_CONFIG || window.KF_SUPABASE_CONFIG.isValid === false) {
    console.error("Konfigurasi Supabase tidak ditemukan atau tidak valid.");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS SDK belum dimuat.");
    return;
  }

  const supabase = window.supabase.createClient(
    window.KF_SUPABASE_CONFIG.url,
    window.KF_SUPABASE_CONFIG.anonKey
  );

  /** Flatten nested data dari member_secure_content agar kompatibel dengan index.html */
  function flattenContent(item) {
    if (!item || typeof item !== "object") return item;
    const data = item.data && typeof item.data === "object" ? item.data : {};
    const flat = Object.assign({}, item, data);
    delete flat.data;
    flat.learning_stage = Number(flat.learning_stage) || 1;
    return flat;
  }

  window.api = async function (action, payload) {
    if (action === "daftar") {
      const { data: signUpData, error: authError } = await supabase.auth.signUp({
        email: String(payload.email || "").trim().toLowerCase(),
        password: payload.password,
        options: {
          data: {
            nama: payload.nama,
            username: payload.username,
            sekolah: payload.sekolah,
            kelas: payload.kelas,
            jenjang: payload.jenjang,
            wa: payload.wa || "",
            paket: payload.paket || ""
          }
        }
      });
      if (authError) throw new Error(authError.message || "Pendaftaran gagal.");
      return {
        ok: true,
        user: signUpData && signUpData.user ? { id: signUpData.user.id, email: signUpData.user.email } : null,
        needsEmailConfirmation: !(signUpData && signUpData.session)
      };
    }

    if (action === "login") {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: String(payload.username || payload.email || "").trim().toLowerCase(),
        password: payload.password
      });
      if (authError) throw new Error("Email atau password salah.");

      const { data: profile, error: profError } = await supabase
        .from("member_profiles")
        .select("id,email,nama,username,kelas,wa,sekolah,jenjang,paket,status,berakhir,tahap_terbuka,created_at,updated_at")
        .eq("id", authData.user.id)
        .single();

      if (profError) throw new Error("Profil member gagal dimuat.");
      if (profile.status === "dihapus") throw new Error("Akun ini telah dihapus.");

      return { ok: true, member: profile };
    }

    throw new Error("Aksi publik tidak dikenali: " + action);
  };

  window.KFMemberAuth = {
    configured: true,
    client: supabase,

    listPaket: async function () {
      const { data, error } = await supabase
        .from("member_packages")
        .select("*")
        .eq("aktif", true)
        .order("harga", { ascending: true });
      if (error) throw error;
      const list = (data || []).filter(function (p) { return p.nama !== "_PAYMENT_CONFIG_"; });
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
    },

    kontenMember: async function (jenjang) {
      const { data, error } = await supabase.rpc("member_secure_content");
      if (error) throw error;
      const list = (data || []).map(flattenContent);
      const filtered = jenjang ? list.filter(function (item) { return item.jenjang === jenjang; }) : list;
      return { ok: true, data: filtered };
    },

    dataBelajar: async function () {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return { progress: [], bookmarks: [], attempts: [], certificates: [] };
      const userId = sessionData.session.user.id;

      const results = await Promise.all([
        supabase.from("member_progress").select("*").eq("user_id", userId),
        supabase.from("member_bookmarks").select("*").eq("user_id", userId),
        supabase.from("member_answer_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30)
      ]);

      return {
        progress: results[0].data || [],
        bookmarks: results[1].data || [],
        attempts: results[2].data || [],
        certificates: []
      };
    },

    cekJawaban: async function (contentId, jawaban) {
      const { data, error } = await supabase.rpc("check_member_answer", {
        p_content_id: contentId,
        p_answer: jawaban
      });
      if (error) throw error;
      return data;
    },

    simpanProgress: async function (contentId, state) {
      if (!contentId) return { ok: false };
      const { error } = await supabase.rpc("touch_member_content", { p_content_id: contentId });
      if (error) throw error;
      // Nilai selesai/skor tidak ditulis langsung dari browser.
      // check_member_answer() di server yang menandai soal benar sebagai selesai.
      return { ok: true, state: state || null };
    },

    setBookmark: async function (contentId, aktif) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData && userData.user;
      if (!user) return;
      if (aktif) {
        const { error } = await supabase.from("member_bookmarks")
          .upsert({ user_id: user.id, content_id: contentId }, { onConflict: "user_id,content_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_bookmarks")
          .delete().match({ user_id: user.id, content_id: contentId });
        if (error) throw error;
      }
      return { ok: true };
    }
  };

  window.addEventListener("DOMContentLoaded", async function () {
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session && document.getElementById("dash")) {
      const { data: profile } = await supabase
        .from("member_profiles")
        .select("id,email,nama,username,kelas,wa,sekolah,jenjang,paket,status,berakhir,tahap_terbuka,created_at,updated_at")
        .eq("id", sess.session.user.id)
        .single();
      if (profile && typeof masukPeserta === "function") {
        var dash = document.getElementById("dash");
        if (dash && window.getComputedStyle(dash).display === "none") {
          masukPeserta(profile);
        }
      }
    }

    supabase
      .from("member_packages")
      .select("deskripsi")
      .eq("nama", "_PAYMENT_CONFIG_")
      .maybeSingle()
      .then(function (res) {
        var data = res.data;
        if (!data || !data.deskripsi) return;
        try {
          var pay = JSON.parse(data.deskripsi);
          var pairs = [
            ["paymentBank", pay.bank],
            ["paymentAccountNumber", pay.nomorRekening],
            ["paymentAccountOwner", pay.pemilikRekening]
          ];
          pairs.forEach(function (pair) {
            var el = document.getElementById(pair[0]);
            if (el) el.textContent = pair[1] || "-";
          });
          var eWa = document.getElementById("paymentWhatsAppLink");
          if (eWa && pay.whatsapp) {
            var pkt = "Paket";
            try {
              var p = JSON.parse(localStorage.getItem("kf_member_profile") || "null");
              if (p && p.paket) pkt = p.paket;
            } catch (e) {}
            eWa.href =
              "https://wa.me/" +
              pay.whatsapp +
              "?text=" +
              encodeURIComponent(
                "Halo Admin KlinikFisikapku, saya ingin mengirim bukti transfer untuk aktivasi Member Area.\n\nPaket: " + pkt
              );
          }
        } catch (e) {}
      });
  });

  window.kirimResetPassword = async function () {
    var el = document.getElementById("user") || document.getElementById("email");
    var emailStr = el ? el.value : "";
    if (!emailStr || !String(emailStr).trim()) {
      alert("Masukkan alamat Email Google Anda pada kolom pengisian terlebih dahulu.");
      return;
    }
    var { error } = await supabase.auth.resetPasswordForEmail(String(emailStr).trim(), {
      redirectTo: window.location.origin + window.location.pathname + "#reset"
    });
    if (error) alert("Gagal mengirim link reset: " + error.message);
    else alert("Link pemulihan password telah dikirim ke email Anda.");
  };
})();

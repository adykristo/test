// supabase-admin.js — Admin Member Area KlinikFisikapku (Tahap Belajar 12 Bulan)
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

  window.KFSupabaseAdmin = {
    configured: true,

    showLogin: function (message) {
      const esc = (value) => String(value || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));
      document.body.innerHTML = `
        <style>
          *{box-sizing:border-box}
          body{margin:0;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#2c1740}
          .kf-login-page{min-height:100vh;display:grid;place-items:center;padding:28px;background:
            radial-gradient(circle at 18% 15%,rgba(255,255,255,.16),transparent 27%),
            radial-gradient(circle at 82% 85%,rgba(255,255,255,.12),transparent 24%),
            linear-gradient(125deg,#42136f 0%,#7024c8 48%,#ed42b4 100%)}
          .kf-login-card{width:min(460px,100%);background:rgba(255,255,255,.97);border:1px solid rgba(255,255,255,.7);border-radius:28px;padding:34px;box-shadow:0 28px 80px rgba(31,9,54,.32)}
          .kf-logo{width:62px;height:62px;border-radius:18px;display:grid;place-items:center;margin-bottom:20px;background:linear-gradient(135deg,#7c2cff,#ef45ae);color:#fff;font-size:28px;font-weight:900;box-shadow:0 12px 28px rgba(126,44,255,.28)}
          .kf-title{margin:0;font-size:29px;line-height:1.15;color:#31134f}.kf-sub{margin:8px 0 25px;color:#806c91}
          .kf-alert{margin:0 0 18px;padding:12px 14px;border:1px solid #ffd0d0;border-radius:12px;background:#fff2f2;color:#a52222}
          .kf-form{display:grid;gap:15px}.kf-label{display:grid;gap:7px;font-weight:800;font-size:13px}
          .kf-input{width:100%;padding:13px 14px;border:1px solid #d9c8e8;border-radius:12px;background:#faf8fd;color:#2c1740;font:inherit;outline:none;transition:.2s}
          .kf-input:focus{border-color:#8c42df;box-shadow:0 0 0 4px rgba(140,66,223,.11);background:#fff}
          .kf-btn{width:100%;border:0;border-radius:12px;padding:13px 16px;font:inherit;font-weight:850;cursor:pointer;transition:.18s}
          .kf-btn:disabled{opacity:.65;cursor:wait}.kf-primary{color:#fff;background:linear-gradient(105deg,#7024c8,#e83fac);box-shadow:0 10px 24px rgba(120,39,200,.22)}
          .kf-primary:hover{transform:translateY(-1px)}
          .kf-divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#9b8aa8;font-size:12px}.kf-divider:before,.kf-divider:after{content:"";height:1px;flex:1;background:#e7dced}
          .kf-google{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:1px solid #d9cfe1;color:#38224b}
          .kf-google:hover{background:#faf7fd;border-color:#bda7ce}.kf-g{font-size:20px;font-weight:900;color:#4285f4}
          .kf-note{margin:20px 0 0;padding:12px 14px;border-radius:12px;background:#f7efff;color:#65457c;font-size:12px;line-height:1.5}
          .kf-back{display:block;text-align:center;margin-top:18px;color:#7133a5;text-decoration:none;font-weight:700;font-size:13px}.kf-back:hover{text-decoration:underline}
          .kf-msg{min-height:19px;color:#a32626;font-size:13px}
          @media(max-width:520px){.kf-login-card{padding:26px 21px;border-radius:22px}.kf-title{font-size:25px}}
        </style>
        <main class="kf-login-page">
          <section class="kf-login-card" aria-label="Login Admin Member">
            <div class="kf-logo">K</div>
            <h1 class="kf-title">Masuk ke Admin Member</h1>
            <p class="kf-sub">KlinikFisikapku · Panel khusus Super Admin Member</p>
            ${message ? `<div class="kf-alert">${esc(message)}</div>` : ""}
            <form id="kfAdminLoginForm" class="kf-form">
              <label class="kf-label">Email
                <input id="kfAdminEmail" class="kf-input" type="email" autocomplete="username" placeholder="nama@gmail.com" required>
              </label>
              <label class="kf-label">Password
                <input id="kfAdminPassword" class="kf-input" type="password" autocomplete="current-password" placeholder="Masukkan password" required>
              </label>
              <button id="kfAdminLoginButton" class="kf-btn kf-primary" type="submit">Masuk ke Admin Member</button>
              <div id="kfAdminLoginMessage" class="kf-msg" role="status"></div>
            </form>
            <div class="kf-divider"><span>atau</span></div>
            <button id="kfGoogleAdminLogin" class="kf-btn kf-google" type="button"><span class="kf-g">G</span> Masuk dengan Google</button>
            <div class="kf-note">Login Google tetap diperiksa ke tabel <b>member_admins</b>. Hanya akun dengan role <b>super_admin</b> dan status aktif yang dapat membuka panel ini.</div>
            <a class="kf-back" href="./index.html">← Kembali ke Member Area</a>
          </section>
        </main>`;

      const form = document.getElementById("kfAdminLoginForm");
      if (form) form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = document.getElementById("kfAdminLoginButton");
        const msg = document.getElementById("kfAdminLoginMessage");
        button.disabled = true; button.textContent = "Memeriksa…"; msg.textContent = "";
        try {
          const email = document.getElementById("kfAdminEmail").value.trim();
          const password = document.getElementById("kfAdminPassword").value;
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          const ok = await window.KFSupabaseAdmin.ensureAdmin();
          if (ok) window.location.reload();
        } catch (err) {
          msg.textContent = "Login gagal: " + (err && err.message ? err.message : err);
          button.disabled = false; button.textContent = "Masuk ke Admin Member";
        }
      });

      const googleButton = document.getElementById("kfGoogleAdminLogin");
      if (googleButton) googleButton.addEventListener("click", async () => {
        const msg = document.getElementById("kfAdminLoginMessage");
        googleButton.disabled = true; googleButton.textContent = "Menghubungkan ke Google…"; msg.textContent = "";
        try {
          const redirectTo = new URL("./admin.html", window.location.href).href;
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo }
          });
          if (error) throw error;
        } catch (err) {
          msg.textContent = "Login Google gagal: " + (err && err.message ? err.message : err);
          googleButton.disabled = false; googleButton.innerHTML = '<span class="kf-g">G</span> Masuk dengan Google';
        }
      });
    },

    ensureAdmin: async function () {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        this.showLogin();
        return false;
      }

      const { data, error } = await supabase
        .from("member_admins")
        .select("role, active, display_name")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error || !data || data.active !== true || data.role !== "super_admin") {
        await supabase.auth.signOut();
        this.showLogin("Akun ini tidak memiliki hak Super Admin Member yang aktif.");
        return false;
      }
      return true;
    },

    api: async function (action, payload) {
      payload = payload || {};
      if (action !== "adminLogin") {
        const allowed = await this.ensureAdmin();
        if (!allowed) throw new Error("Sesi admin tidak valid.");
      }
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
              durasi_hari: 1,
              harga: 0,
              deskripsi: deskripsi,
              aktif: true
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
          const stage = Number(i.learning_stage || 1);
          if (!Number.isInteger(stage) || stage < 1 || stage > 12) {
            throw new Error("Tahap belajar harus berupa angka 1 sampai 12.");
          }
          if (!String(i.jenjang || "").trim()) throw new Error("Jenjang wajib diisi.");
          if (!String(i.judul || "").trim()) throw new Error("Judul konten wajib diisi.");
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
            learning_stage: stage,
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

          let result;
          if (i.id) {
            result = await supabase.from("member_content").update(row).eq("id", i.id);
          } else {
            delete row.id;
            result = await supabase.from("member_content").insert(row);
          }
          if (result.error) throw result.error;
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

  window.KFLogoutAllAdminSessions = async function () {
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      alert("Semua sesi admin telah dikeluarkan. Silakan login kembali.");
      window.location.href = "./admin.html";
    } catch (err) {
      alert("Gagal mengeluarkan semua sesi: " + (err && err.message ? err.message : err));
    }
  };

  window.KFSetupMFAAdmin = async function () {
    try {
      const ok = await window.KFSupabaseAdmin.ensureAdmin();
      if (!ok) return;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors && factors.totp || []).find(function (f) { return f.status === "verified"; });
      if (verified) {
        alert("MFA Authenticator sudah aktif pada akun admin ini.");
        return;
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "KlinikFisikapku Admin" });
      if (error) throw error;
      if (!data || !data.id || !data.totp) throw new Error("Data MFA tidak lengkap.");

      const popup = window.open("", "kf_mfa_setup", "width=520,height=680");
      if (popup) {
        const qr = String(data.totp.qr_code || "").replace(/"/g, "&quot;");
        const secret = String(data.totp.secret || "").replace(/[<>&]/g, "");
        popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Setup MFA</title></head><body style="font-family:Arial;padding:24px;text-align:center"><h2>KlinikFisikapku · MFA Admin</h2><p>Scan QR ini dengan aplikasi Authenticator.</p><img alt="QR MFA" style="max-width:300px;width:100%" src="'+qr+'"><p>Jika QR tidak dapat dipindai, masukkan secret berikut:</p><code style="word-break:break-all">'+secret+'</code><p>Setelah itu kembali ke jendela Admin dan masukkan kode 6 digit.</p></body></html>');
        popup.document.close();
      } else {
        alert("Izinkan pop-up untuk menampilkan QR MFA. Secret: " + data.totp.secret);
      }
      const code = prompt("Masukkan kode 6 digit dari aplikasi Authenticator:");
      if (code === null) { await supabase.auth.mfa.unenroll({ factorId: data.id }); return; }
      if (!/^\\d{6}$/.test(code.trim())) {
        await supabase.auth.mfa.unenroll({ factorId: data.id });
        throw new Error("Kode Authenticator harus 6 digit.");
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code: code.trim() });
      if (verifyError) {
        await supabase.auth.mfa.unenroll({ factorId: data.id });
        throw verifyError;
      }
      if (popup && !popup.closed) popup.close();
      alert("MFA Authenticator berhasil diaktifkan.");
    } catch (err) {
      alert("Gagal mengaktifkan MFA: " + (err && err.message ? err.message : err));
    }
  };

  window.KFLogoutAdminMember = async function () {
    await supabase.auth.signOut();
    window.location.href = "./admin.html";
  };
})();

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
    client: supabase,
    configured: true,

    currentRole: null,

    showAdminLogin: function () {
      return new Promise(function (resolve) {
        var old = document.getElementById("kfAdminLoginOverlay");
        if (old) old.remove();

        var overlay = document.createElement("div");
        overlay.id = "kfAdminLoginOverlay";
        overlay.innerHTML = `
          <div style="position:fixed;inset:0;z-index:99999;background:rgba(24,7,38,.68);display:flex;align-items:center;justify-content:center;padding:20px">
            <form id="kfAdminLoginForm" style="width:min(430px,100%);background:#fff;border-radius:20px;padding:28px;box-shadow:0 28px 80px rgba(0,0,0,.30);font-family:inherit">
              <div style="font-size:12px;font-weight:900;letter-spacing:.06em;color:#8b5aa8;margin-bottom:5px">KLINIKFISIKAPKU</div>
              <h2 style="margin:0 0 7px;color:#210a35">Login Admin Member</h2>
              <p style="margin:0 0 20px;color:#755f82;font-size:14px">Masuk dengan akun Super Admin atau Admin Konten.</p>
              <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">Email</label>
              <input id="kfAdminEmail" type="email" autocomplete="username" required placeholder="nama@gmail.com" style="box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddcbed;border-radius:10px;margin-bottom:14px;font:inherit">
              <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">Password</label>
              <input id="kfAdminPassword" type="password" autocomplete="current-password" required placeholder="Password" style="box-sizing:border-box;width:100%;padding:12px;border:1px solid #ddcbed;border-radius:10px;margin-bottom:10px;font:inherit">
              <div id="kfAdminLoginError" style="display:none;background:#fff1ed;color:#a9341d;padding:10px;border-radius:9px;font-size:13px;margin:8px 0 12px"></div>
              <button id="kfAdminLoginButton" type="submit" style="width:100%;border:0;border-radius:10px;padding:12px;background:linear-gradient(90deg,#7b2ff7,#f857a6);color:#fff;font-weight:900;cursor:pointer">Masuk</button>
            </form>
          </div>`;
        document.body.appendChild(overlay);

        var form = overlay.querySelector("#kfAdminLoginForm");
        var emailEl = overlay.querySelector("#kfAdminEmail");
        var passEl = overlay.querySelector("#kfAdminPassword");
        var errorEl = overlay.querySelector("#kfAdminLoginError");
        var button = overlay.querySelector("#kfAdminLoginButton");
        setTimeout(function () { emailEl.focus(); }, 50);

        form.addEventListener("submit", async function (ev) {
          ev.preventDefault();
          errorEl.style.display = "none";
          button.disabled = true;
          button.textContent = "Memeriksa…";
          try {
            var result = await supabase.auth.signInWithPassword({
              email: emailEl.value.trim(),
              password: passEl.value
            });
            if (result.error || !result.data || !result.data.session) {
              throw new Error(result.error && result.error.message ? result.error.message : "Login gagal.");
            }
            overlay.remove();
            resolve(result.data.session);
          } catch (err) {
            errorEl.textContent = "Login gagal: " + (err && err.message ? err.message : String(err));
            errorEl.style.display = "block";
            button.disabled = false;
            button.textContent = "Masuk";
          }
        });
      });
    },

    applyRoleUI: function (role) {
      document.documentElement.setAttribute("data-admin-role", role || "");
      if (role !== "content_admin") return;

      var blocked = ["ringkasan", "pendaftaran", "member", "paket", "transaksi", "laporan", "keamanan", "kelolaAdmin"];
      document.querySelectorAll("aside button").forEach(function (btn) {
        var click = btn.getAttribute("onclick") || "";
        if (blocked.some(function (id) { return click.indexOf("'" + id + "'") !== -1 || click.indexOf('"' + id + '"') !== -1; })) {
          btn.style.display = "none";
        }
      });

      document.querySelectorAll("header button").forEach(function (btn) {
        var click = btn.getAttribute("onclick") || "";
        if (click.indexOf("admin-dashboard-login.html") !== -1) btn.style.display = "none";
      });

      document.querySelectorAll(".panel").forEach(function (panel) { panel.classList.remove("show"); });
      document.querySelectorAll("aside button").forEach(function (btn) { btn.classList.remove("active"); });
      var first = Array.from(document.querySelectorAll("aside button")).find(function (btn) {
        var click = btn.getAttribute("onclick") || "";
        return btn.style.display !== "none" && (click.indexOf("'modul'") !== -1 || click.indexOf('"modul"') !== -1);
      });
      if (first) first.click();
    },

    ensureAdmin: async function () {
      var sessionResult = await supabase.auth.getSession();
      var session = sessionResult.data.session;
      if (!session) session = await this.showAdminLogin();
      if (!session) return false;

      var roleResult = await supabase
        .from("member_admins")
        .select("role,active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      var data = roleResult.data;
      if (roleResult.error || !data || data.active !== true || !["super_admin", "content_admin"].includes(data.role)) {
        await supabase.auth.signOut();
        alert("Akses ditolak: akun ini bukan Admin Member yang aktif.");
        return false;
      }

      this.currentRole = data.role;
      this.applyRoleUI(data.role);
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
                aktif: p.aktif, jenjang: p.jenjang || "", bulan: p.bulan || null, tipe: p.tipe || "bulanan", prasyarat: p.prasyarat || "", urutan: p.urutan || 0
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
              aktif: item.aktif !== false,
              jenjang: item.jenjang || null, bulan: item.bulan ? Number(item.bulan) : null, tipe: item.tipe || "bulanan", prasyarat: item.prasyarat || null, urutan: Number(item.urutan) || 0
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


        case "adminListAdmins": {
          const { data, error } = await supabase.rpc("admin_list_admin_accounts");
          if (error) throw error;
          return { ok: true, data: data || [] };
        }

        case "adminCreateAdmin": {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Sesi admin tidak ditemukan.");
          const response = await fetch(window.KF_SUPABASE_CONFIG.url + "/functions/v1/admin-user-management", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + session.access_token,
              "apikey": window.KF_SUPABASE_CONFIG.anonKey
            },
            body: JSON.stringify({ action: "create", payload: payload })
          });
          const result = await response.json().catch(function(){ return {}; });
          if (!response.ok || !result.ok) throw new Error(result.error || "Gagal membuat admin.");
          return result;
        }

        case "adminSetAdminActive": {
          const { error } = await supabase.rpc("admin_set_admin_active", {
            p_user_id: payload.user_id,
            p_active: !!payload.active
          });
          if (error) throw error;
          return { ok: true };
        }

        case "adminDeleteAdmin": {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Sesi admin tidak ditemukan.");
          const response = await fetch(window.KF_SUPABASE_CONFIG.url + "/functions/v1/admin-user-management", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + session.access_token,
              "apikey": window.KF_SUPABASE_CONFIG.anonKey
            },
            body: JSON.stringify({ action: "delete", payload: payload })
          });
          const result = await response.json().catch(function(){ return {}; });
          if (!response.ok || !result.ok) throw new Error(result.error || "Gagal menghapus admin.");
          return result;
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

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
    client: supabase,

    showLogin: function (message) {
      return new Promise((resolve) => {
        const old = document.getElementById("kfAdminLoginOverlay");
        if (old) old.remove();

        const overlay = document.createElement("div");
        overlay.id = "kfAdminLoginOverlay";
        overlay.innerHTML = `
          <div class="kf-admin-login-card" role="dialog" aria-modal="true" aria-labelledby="kfAdminLoginTitle">
            <div class="kf-admin-login-logo">K</div>
            <h2 id="kfAdminLoginTitle">Masuk Admin Member</h2>
            <p class="kf-admin-login-sub">Gunakan akun Super Admin KlinikFisikapku.</p>
            <form id="kfAdminLoginForm">
              <label for="kfAdminEmail">Email</label>
              <input id="kfAdminEmail" type="email" autocomplete="username" required value="adykristo@gmail.com">
              <label for="kfAdminPassword">Password</label>
              <input id="kfAdminPassword" type="password" autocomplete="current-password" required placeholder="Masukkan password">
              <div id="kfAdminLoginError" class="kf-admin-login-error" ${message ? "" : "hidden"}>${message || ""}</div>
              <button id="kfAdminLoginButton" type="submit">Masuk ke Admin Member</button>
            </form>
            <a class="kf-admin-login-back" href="index.html">← Kembali ke Member Area</a>
          </div>`;

        const style = document.createElement("style");
        style.id = "kfAdminLoginStyle";
        style.textContent = `
          #kfAdminLoginOverlay{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#32104f 0%,#7024c4 52%,#e63ca9 100%);font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
          .kf-admin-login-card{width:min(420px,100%);background:#fff;border-radius:24px;padding:34px;box-shadow:0 24px 80px rgba(27,8,45,.35);color:#32104f}
          .kf-admin-login-logo{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;margin-bottom:22px;background:linear-gradient(135deg,#8738ee,#ed3ba7);color:#fff;font-size:26px;font-weight:900;box-shadow:0 10px 28px rgba(135,56,238,.25)}
          .kf-admin-login-card h2{margin:0 0 7px;font-size:27px}.kf-admin-login-sub{margin:0 0 24px;color:#786887;font-size:14px}
          .kf-admin-login-card label{display:block;margin:14px 0 7px;font-size:13px;font-weight:800}.kf-admin-login-card input{box-sizing:border-box;width:100%;height:48px;border:1px solid #ddcfea;border-radius:12px;padding:0 14px;font-size:15px;outline:none;background:#fbf9fd}.kf-admin-login-card input:focus{border-color:#8a39df;box-shadow:0 0 0 3px rgba(138,57,223,.12)}
          .kf-admin-login-card button{width:100%;height:49px;margin-top:18px;border:0;border-radius:12px;background:linear-gradient(90deg,#7729d1,#e83ca9);color:#fff;font-size:15px;font-weight:900;cursor:pointer}.kf-admin-login-card button:disabled{opacity:.65;cursor:wait}
          .kf-admin-login-error{margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff0f3;color:#a51d3d;font-size:13px;line-height:1.4}.kf-admin-login-error[hidden]{display:none}.kf-admin-login-back{display:block;text-align:center;margin-top:18px;color:#6f42a1;text-decoration:none;font-size:13px;font-weight:700}`;
        document.head.appendChild(style);
        document.body.appendChild(overlay);

        const form = overlay.querySelector("#kfAdminLoginForm");
        const email = overlay.querySelector("#kfAdminEmail");
        const password = overlay.querySelector("#kfAdminPassword");
        const errorBox = overlay.querySelector("#kfAdminLoginError");
        const button = overlay.querySelector("#kfAdminLoginButton");
        setTimeout(() => password.focus(), 50);

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          errorBox.hidden = true;
          button.disabled = true;
          button.textContent = "Memeriksa akun…";
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email.value.trim(),
              password: password.value
            });
            if (error || !data || !data.session) throw new Error(error?.message || "Sesi login tidak terbentuk.");
            const { data: admin, error: adminError } = await supabase
              .from("member_admins")
              .select("role,active")
              .eq("user_id", data.session.user.id)
              .maybeSingle();
            if (adminError || !admin || admin.role !== "super_admin" || admin.active !== true) {
              await supabase.auth.signOut();
              throw new Error("Akun ini bukan Super Admin Member yang aktif.");
            }
            overlay.remove();
            style.remove();
            resolve(true);
          } catch (err) {
            errorBox.textContent = err?.message || String(err);
            errorBox.hidden = false;
            password.value = "";
            password.focus();
            button.disabled = false;
            button.textContent = "Masuk ke Admin Member";
          }
        });
      });
    },

    ensureAdmin: async function () {
      const result = await supabase.auth.getSession();
      let session = result?.data?.session || null;

      if (session) {
        const { data, error } = await supabase
          .from("member_admins")
          .select("role,active")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!error && data && data.role === "super_admin" && data.active === true) return true;
        await supabase.auth.signOut();
        session = null;
      }

      return await this.showLogin("");
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
          const [memberRes, legacyRes, v15Res, logRes] = await Promise.all([
            supabase.rpc("admin_list_members_masked"),
            supabase.from("member_answer_attempts").select("id,user_id,content_id,score,created_at").order("created_at", { ascending: false }).limit(500),
            supabase.from("kf_attempts").select("id,user_id,package_id,objective_score,submitted_at,status").eq("status","submitted").order("submitted_at", { ascending: false }).limit(500),
            supabase.from("member_admin_logs").select("*").order("created_at", { ascending: false }).limit(30)
          ]);
          if (memberRes.error) throw memberRes.error;
          if (legacyRes.error) throw legacyRes.error;
          if (v15Res.error) throw v15Res.error;
          if (logRes.error) throw logRes.error;
          const attempts = (legacyRes.data || []).map(x => ({...x, skor:x.score, jenis:"latihan_lama"}))
            .concat((v15Res.data || []).map(x => ({...x, skor:x.objective_score, created_at:x.submitted_at, jenis:"v15"})));
          const logs = (logRes.data || []).map(x => ({...x, aksi:x.action}));
          return { ok: true, data: { members: memberRes.data || [], attempts, logs } };
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

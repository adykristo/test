(function () {
  "use strict";

  const cfg = window.KF_SUPABASE_CONFIG || {};
  const siap = /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || "")) &&
    !String(cfg.publishableKey || "").startsWith("GANTI_") &&
    String(cfg.publishableKey || "").length > 20;
  let db = null;

  if (siap && window.supabase && typeof window.supabase.createClient === "function") {
    db = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  const $ = (id) => document.getElementById(id);
  const teksError = (error) => {
    const pesan = String((error && error.message) || error || "Terjadi kesalahan.");
    if (/invalid login credentials/i.test(pesan)) return "Email atau password tidak benar.";
    if (/email not confirmed/i.test(pesan)) return "Email belum diverifikasi. Periksa kotak masuk atau folder spam.";
    if (/user already registered/i.test(pesan)) return "Email sudah terdaftar. Silakan masuk atau gunakan Lupa Password.";
    if (/password/i.test(pesan) && /least/i.test(pesan)) return "Password belum memenuhi ketentuan keamanan.";
    return pesan;
  };
  function notice(id, pesan, jenis) {
    const el = $(id);
    if (!el) return;
    el.textContent = pesan;
    el.className = "auth-notice show " + (jenis || "info");
  }
  function konfigurasiBelumSiap() {
    const pesan = "Sistem akun sedang disiapkan. Admin perlu mengisi Project URL dan Publishable Key Supabase pada supabase-config.js.";
    ["supabaseConfigDaftar", "supabaseConfigLogin"].forEach((id) => {
      const el = $(id); if (el) { el.textContent = pesan; el.classList.add("show"); }
    });
    return false;
  }
  function pastikanSiap(noticeId) {
    if (db) return true;
    konfigurasiBelumSiap();
    if (noticeId) notice(noticeId, "Fitur belum aktif karena Supabase belum dikonfigurasi.", "err");
    return false;
  }
  function redirect(path) {
    return new URL(path || "./", cfg.siteUrl || window.location.href).href;
  }

  window.togglePassword = function (id, btn) {
    const input = $(id); if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
    if (btn) btn.textContent = input.type === "password" ? "◉" : "◎";
  };

  window.daftar = async function (event) {
    event.preventDefault();
    if (!pastikanSiap("daftarNotice")) return;
    const form = event.currentTarget;
    const password = $("passwordDaftar").value;
    if (password !== $("passwordKonfirmasi").value) {
      notice("daftarNotice", "Konfirmasi password belum sama.", "err"); return;
    }
    if (!$("setujuSyarat").checked) {
      notice("daftarNotice", "Setujui syarat layanan dan kebijakan privasi terlebih dahulu.", "err"); return;
    }
    setTombol(form, "Mendaftarkan…");
    try {
      const metadata = {
        nama: $("nama").value.trim(),
        wa: $("wa").value.trim(),
        jenjang: $("kelas").value,
        sekolah: $("sekolah").value.trim(),
        paket: $("paketDaftar").value
      };
      const { data, error } = await db.auth.signUp({
        email: $("email").value.trim().toLowerCase(),
        password,
        options: { data: metadata, emailRedirectTo: redirect("./") }
      });
      if (error) throw error;
      notice("daftarNotice", data.session
        ? "Pendaftaran berhasil. Akun menunggu aktivasi admin."
        : "Pendaftaran berhasil. Tautan verifikasi telah dikirim ke email Anda. Periksa juga folder spam.", "ok");
      form.reset();
    } catch (error) {
      notice("daftarNotice", teksError(error), "err");
    } finally { setTombol(form, ""); }
  };

  window.login = async function (event) {
    event.preventDefault();
    if (!pastikanSiap("loginNotice")) return;
    const form = event.currentTarget;
    setTombol(form, "Memeriksa…");
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: $("user").value.trim().toLowerCase(), password: $("pass").value
      });
      if (error) throw error;
      await arahkanUser(data.user);
    } catch (error) {
      notice("loginNotice", teksError(error), "err");
    } finally { setTombol(form, ""); }
  };

  window.masukGoogle = async function () {
    const sedangDaftar = $("daftar") && $("daftar").classList.contains("show");
    if (!pastikanSiap(sedangDaftar ? "daftarNotice" : "loginNotice")) return;
    if (sedangDaftar) {
      const draft = { nama:$("nama").value.trim(), wa:$("wa").value.trim(), jenjang:$("kelas").value, sekolah:$("sekolah").value.trim(), paket:$("paketDaftar").value };
      if (!draft.nama || !draft.wa || !draft.jenjang || !draft.sekolah || !draft.paket) {
        notice("daftarNotice", "Lengkapi nama, WhatsApp, jenjang, sekolah, dan paket sebelum mendaftar dengan Google.", "err"); return;
      }
      localStorage.setItem("kf_google_profile_draft", JSON.stringify(draft));
    }
    const { error } = await db.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: redirect("./") }
    });
    if (error) notice("loginNotice", teksError(error), "err");
  };

  window.kirimResetPassword = async function () {
    if (!pastikanSiap("loginNotice")) return;
    const awal = ($("user") && $("user").value.trim()) || "";
    const email = window.prompt("Masukkan email akun Member:", awal);
    if (!email) return;
    try {
      const { error } = await db.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirect("./?mode=reset-password")
      });
      if (error) throw error;
      notice("loginNotice", "Tautan reset password sudah dikirim. Periksa email dan folder spam.", "ok");
    } catch (error) { notice("loginNotice", teksError(error), "err"); }
  };

  window.simpanPasswordBaru = async function (event) {
    event.preventDefault();
    if (!pastikanSiap("resetNotice")) return;
    const p1 = $("passwordBaru").value, p2 = $("passwordBaru2").value;
    if (p1 !== p2) { notice("resetNotice", "Konfirmasi password belum sama.", "err"); return; }
    try {
      const { error } = await db.auth.updateUser({ password: p1 });
      if (error) throw error;
      notice("resetNotice", "Password berhasil diperbarui. Silakan masuk kembali.", "ok");
      setTimeout(() => buka("login"), 1100);
    } catch (error) { notice("resetNotice", teksError(error), "err"); }
  };

  window.keluar = async function () {
    if (db) await db.auth.signOut();
    localStorage.removeItem("kf_member_profile");
    window.location.href = "./";
  };

  async function ambilProfil(user) {
    const { data, error } = await db.from("member_profiles").select("*").eq("id", user.id).single();
    if (error) throw error;
    return data;
  }
  async function lengkapiProfilGoogle() {
    const raw=localStorage.getItem("kf_google_profile_draft"); if(!raw) return;
    try {
      const draft=JSON.parse(raw);
      const {error}=await db.rpc("complete_member_profile",{p_nama:draft.nama,p_wa:draft.wa,p_sekolah:draft.sekolah,p_jenjang:draft.jenjang,p_paket:draft.paket});
      if(error) throw error;
      localStorage.removeItem("kf_google_profile_draft");
    } catch(error) { console.warn("Profil Google belum lengkap:",error); }
  }
  async function arahkanUser(user) {
    if (!user) return;
    try {
      await lengkapiProfilGoogle();
      const p = await ambilProfil(user);
      localStorage.setItem("kf_member_profile", JSON.stringify(p));
      const kedaluwarsa = p.berakhir && new Date(p.berakhir).getTime() <= Date.now();
      if (p.status !== "aktif" || kedaluwarsa) {
        $("pendingText").textContent = kedaluwarsa
          ? "Masa aktif akun telah berakhir. Silakan hubungi admin untuk memperpanjang paket."
          : p.status === "ditolak"
          ? "Pendaftaran belum dapat disetujui. Silakan hubungi admin untuk informasi lebih lanjut."
          : "Email sudah terverifikasi. Admin akan mengaktifkan akses setelah data dan pembayaran diperiksa.";
        buka("pending"); return;
      }
      window.masukPeserta(p);
    } catch (error) {
      notice("loginNotice", "Profil belum dapat dimuat: " + teksError(error), "err"); buka("login");
    }
  }

  async function listPaket() {
    if (!db) return { data: [] };
    const { data, error } = await db.from("member_packages").select("nama,harga,deskripsi,durasi_hari").eq("aktif", true).order("harga");
    if (error) throw error;
    return { data: (data || []).map((p) => ({ ...p, durasiHari: p.durasi_hari })) };
  }
  async function kontenMember(jenjang) {
    if (!db) return { data: [] };
    const { data, error } = await db.from("member_content").select("*").eq("jenjang", jenjang).eq("visible", true).order("created_at");
    if (error) throw error;
    return { data: (data || []).map((x) => ({ ...x.data, id:x.id, jenjang:x.jenjang, jenis:x.jenis, tujuan:x.tujuan, topik:x.topik, judul:x.judul, visible:x.visible })) };
  }
  window.KFMemberAuth = { configured: siap, client: db, listPaket, kontenMember };

  document.addEventListener("DOMContentLoaded", async function () {
    if (!siap) { konfigurasiBelumSiap(); return; }
    db.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") buka("reset"); });
    const mode = new URLSearchParams(location.search).get("mode");
    if (mode === "reset-password") { buka("reset"); return; }
    const { data } = await db.auth.getSession();
    if (data.session && data.session.user) await arahkanUser(data.session.user);
  });
})();

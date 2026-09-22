(function () {
  "use strict";
  const cfg = window.KF_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || "")) &&
    !String(cfg.publishableKey || "").startsWith("GANTI_") && String(cfg.publishableKey || "").length > 20;
  const db = configured && window.supabase ? window.supabase.createClient(cfg.url, cfg.publishableKey) : null;
  const PAYMENT_SETTINGS_PACKAGE = "__PENGATURAN_PEMBAYARAN__";
  let idleTimer = null;

  function normalizePaymentSettings(raw) {
    let value = raw || {};
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch (_) { value = {}; }
    }
    return {
      bank: String(value.bank || "").trim().slice(0, 80),
      nomorRekening: String(value.nomorRekening || "").trim().slice(0, 40),
      pemilikRekening: String(value.pemilikRekening || "").trim().slice(0, 100),
      whatsapp: String(value.whatsapp || "6281365657020").replace(/\D/g, "").slice(0, 16)
    };
  }

  function startIdleGuard() {
    const reset=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(async()=>{if(db)await db.auth.signOut();window.alert("Sesi admin berakhir karena tidak aktif selama 30 menit.");location.reload();},30*60*1000);};
    ["pointerdown","keydown","scroll","touchstart"].forEach(name=>window.addEventListener(name,reset,{passive:true}));
    reset();
  }

  async function ensureMfaChallenge(){
    const factors=await db.auth.mfa.listFactors();if(factors.error)throw factors.error;
    const factor=(factors.data?.totp||[]).find(x=>x.status==="verified");if(!factor)return;
    const aal=await db.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error)throw aal.error;
    if(aal.data.currentLevel==="aal2")return;
    const code=window.prompt("Masukkan 6 digit kode Authenticator untuk Admin Member:");
    if(!code)throw new Error("Verifikasi MFA dibatalkan");
    const verified=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code:code.trim()});if(verified.error)throw verified.error;
  }

  function safe(v) { return String(v || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]); }
  function showSetup() {
    const layout = document.querySelector(".layout"); if (!layout) return;
    layout.innerHTML = `<main style="width:min(760px,calc(100% - 32px));margin:42px auto"><div class="card" style="padding:28px"><h1>Supabase Belum Dikonfigurasi</h1><p>Buat proyek Supabase, jalankan <code>supabase-setup.sql</code>, lalu isi Project URL dan Publishable Key pada <code>supabase-config.js</code>.</p><p>Ikuti langkah lengkap pada <code>PANDUAN-SUPABASE-MEMBER.md</code>.</p><button class="btn" onclick="location.href='../admin-dashboard-login.html'">Kembali ke Admin Utama</button></div></main>`;
  }
  function showLogin(message) {
    const layout = document.querySelector(".layout"); if (!layout) return;
    layout.innerHTML = `<main style="width:min(430px,calc(100% - 32px));margin:54px auto"><form class="card" style="padding:28px" onsubmit="KFLoginAdminMember(event)"><h1 style="text-align:center">Masuk Admin Member</h1><p style="text-align:center;color:#745d86">Gunakan akun email yang sudah dimasukkan ke tabel <code>member_admins</code>.</p><label>Email Admin</label><input id="kfAdminEmail" type="email" required autocomplete="email" placeholder="admin@email.com"><label>Password</label><input id="kfAdminPass" type="password" required autocomplete="current-password"><button class="btn" style="width:100%;margin-top:16px">Masuk</button><div id="kfAdminMsg" style="margin-top:12px;color:#b52652">${safe(message)}</div></form></main>`;
  }
  window.KFLoginAdminMember = async function (e) {
    e.preventDefault();
    const out=document.getElementById("kfAdminMsg"); if(out) out.textContent="Memeriksa…";
    const { error } = await db.auth.signInWithPassword({ email:document.getElementById("kfAdminEmail").value.trim(), password:document.getElementById("kfAdminPass").value });
    if (error) { if(out) out.textContent=error.message; return; }
    location.reload();
  };
  window.KFLogoutAdminMember = async function () {
    if (db) await db.auth.signOut();
    location.href="../admin-dashboard-login.html";
  };

  async function ensureAdmin() {
    if (!configured) { showSetup(); return false; }
    const { data:{ session } } = await db.auth.getSession();
    if (!session) { showLogin(""); return false; }
    try{await ensureMfaChallenge();}catch(error){await db.auth.signOut();showLogin("Verifikasi MFA gagal: "+safe(error.message));return false;}
    const { data, error } = await db.from("member_admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if (error || !data) { await db.auth.signOut(); showLogin("Akun ini tidak mempunyai hak Admin Member."); return false; }
    startIdleGuard();
    return true;
  }

  window.muatKeamananAdmin = async function(){
    if(!db)return;
    try{
      const [aal,factors]=await Promise.all([db.auth.mfa.getAuthenticatorAssuranceLevel(),db.auth.mfa.listFactors()]);
      if(aal.error)throw aal.error;if(factors.error)throw factors.error;
      const verified=(factors.data?.totp||[]).some(x=>x.status==="verified");
      const level=aal.data.currentLevel||"aal1";
      const a=document.getElementById("securityAal"),m=document.getElementById("securityMfa"),msg=document.getElementById("securityMessage");
      if(a)a.textContent=level.toUpperCase();if(m)m.textContent=verified?"Aktif":"Belum";
      if(msg)msg.textContent=verified?(level==="aal2"?"MFA aktif dan sesi ini sudah diverifikasi.":"MFA aktif; verifikasi ulang diperlukan untuk sesi sensitif."):"Aktifkan MFA agar password saja tidak cukup untuk mengambil alih admin.";
    }catch(error){const msg=document.getElementById("securityMessage");if(msg)msg.textContent="Pemeriksaan gagal: "+error.message;}
  };

  window.KFSetupMFAAdmin = async function(){
    try{
      const listed=await db.auth.mfa.listFactors();if(listed.error)throw listed.error;
      if((listed.data?.totp||[]).some(x=>x.status==="verified")){window.alert("MFA TOTP sudah aktif pada akun ini.");return;}
      for(const old of (listed.data?.totp||[])){if(old.status!=="verified")await db.auth.mfa.unenroll({factorId:old.id});}
      const enrolled=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"KlinikFisikapku Admin"});if(enrolled.error)throw enrolled.error;
      const secret=enrolled.data.totp.secret;
      const code=window.prompt("Tambahkan akun di aplikasi Authenticator menggunakan secret berikut:\n\n"+secret+"\n\nLalu masukkan kode 6 digit:");
      if(!code){await db.auth.mfa.unenroll({factorId:enrolled.data.id});return;}
      const verified=await db.auth.mfa.challengeAndVerify({factorId:enrolled.data.id,code:code.trim()});if(verified.error)throw verified.error;
      window.alert("MFA berhasil diaktifkan.");await window.muatKeamananAdmin();
    }catch(error){window.alert("MFA belum aktif: "+error.message);}
  };

  window.KFLogoutAllAdminSessions = async function(){
    if(!db||!window.confirm("Keluar dari semua sesi admin di seluruh perangkat?"))return;
    const {error}=await db.auth.signOut({scope:"global"});if(error){window.alert(error.message);return;}location.reload();
  };
  function cleanContent(item) {
    const standard = ["id","jenjang","jenis","tujuan","topik","judul","visible","created_at","updated_at","data"];
    const data = { ...(item.data || {}) };
    Object.keys(item).forEach(k => { if (!standard.includes(k)) data[k]=item[k]; });
    return { id:item.id || undefined, jenjang:item.jenjang || "sd", jenis:item.jenis || "soal", tujuan:item.tujuan || null, topik:item.topik || "", judul:item.judul || "", visible:item.visible !== false, data };
  }
  function flatContent(x) { return { ...(x.data || {}), id:x.id, jenjang:x.jenjang, jenis:x.jenis, tujuan:x.tujuan, topik:x.topik, judul:x.judul, visible:x.visible, created_at:x.created_at }; }
  async function logAdmin(aksi,targetType,targetId,detail) {
    const {error}=await db.rpc("log_admin_event",{p_action:aksi,p_target_type:targetType||"",p_target_id:String(targetId||""),p_detail:detail||{}});
    if(error) console.warn("Log admin belum tersimpan:",error.message);
  }

  async function api(action, payload) {
    let q, data, error;
    switch (action) {
      case "adminLogin": return { ok:true };
      case "adminListMember":
        ({data,error}=await db.rpc("admin_list_members"));
        if(error) throw error; return {ok:true,data:data||[]};
      case "adminListPaket":
        ({data,error}=await db.from("member_packages").select("*").order("harga"));
        if(error) throw error; return {ok:true,data:(data||[]).filter(p=>p.nama!==PAYMENT_SETTINGS_PACKAGE).map(p=>({...p,durasiHari:p.durasi_hari}))};
      case "adminSimpanPaket": {
        const p=payload.item||{};
        ({error}=await db.from("member_packages").upsert({nama:p.nama,durasi_hari:Number(p.durasiHari)||30,harga:Number(p.harga)||0,deskripsi:p.deskripsi||"",aktif:true},{onConflict:"nama"}));
        if(error) throw error; await logAdmin("simpan_paket","paket",p.nama,{harga:p.harga,durasiHari:p.durasiHari}); return {ok:true};
      }
      case "adminGetPaymentSettings": {
        ({data,error}=await db.from("member_packages").select("deskripsi").eq("nama",PAYMENT_SETTINGS_PACKAGE).maybeSingle());
        if(error) throw error;
        return {ok:true,data:normalizePaymentSettings(data&&data.deskripsi)};
      }
      case "adminSavePaymentSettings": {
        const settings=normalizePaymentSettings(payload.item);
        if(settings.bank.length<2) throw new Error("Nama bank atau metode pembayaran wajib diisi.");
        if(!/^[0-9 .-]{4,40}$/.test(settings.nomorRekening)) throw new Error("Nomor rekening hanya boleh berisi angka, spasi, titik, atau tanda hubung.");
        if(settings.pemilikRekening.length<2) throw new Error("Nama pemilik rekening wajib diisi.");
        if(settings.whatsapp.startsWith("0")) settings.whatsapp="62"+settings.whatsapp.slice(1);
        if(!/^62\d{8,13}$/.test(settings.whatsapp)) throw new Error("Nomor WhatsApp harus memakai format 62, contoh 6281234567890.");
        ({error}=await db.from("member_packages").upsert({nama:PAYMENT_SETTINGS_PACKAGE,durasi_hari:1,harga:0,deskripsi:JSON.stringify(settings),aktif:true},{onConflict:"nama"}));
        if(error) throw error;
        await logAdmin("ubah_rekening_pembayaran","pengaturan","pembayaran_manual",{bank:settings.bank,pemilikRekening:settings.pemilikRekening,whatsapp:settings.whatsapp});
        return {ok:true,data:settings};
      }
      case "adminVerifikasi": {
        ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"activate",p_package:payload.paket,p_note:""}));
        if(error) throw error; return {ok:true};
      }
      case "adminTolak": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"reject",p_package:"",p_note:payload.catatan||""})); if(error)throw error; return {ok:true};
      case "adminAktifkanKembali": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"reactivate",p_package:"",p_note:""})); if(error)throw error; return {ok:true};
      case "adminNonaktifkan": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"deactivate",p_package:"",p_note:""})); if(error)throw error; return {ok:true};
      case "adminHapusMember": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"soft_delete",p_package:"",p_note:""})); if(error)throw error; return {ok:true};
      case "adminListKonten":
        ({data,error}=await db.from("member_content").select("*").order("created_at")); if(error) throw error; return {ok:true,data:(data||[]).map(flatContent)};
      case "adminSimpanKonten": {
        const row=cleanContent(payload.item||{}); if(!row.id) delete row.id;
        ({data,error}=await db.from("member_content").upsert(row).select().single()); if(error) throw error; return {ok:true,data:flatContent(data)};
      }
      case "adminHapusKonten":
        ({error}=await db.from("member_content").delete().eq("id",payload.id)); if(error) throw error; await logAdmin("hapus_konten","konten",payload.id,{}); return {ok:true};
      case "adminListOrders":
        ({data,error}=await db.from("member_orders").select("*").order("created_at",{ascending:false}));
        if(error) throw error;
        { const {data:profiles,error:profileError}=await db.from("member_profiles").select("id,nama,email,wa"); if(profileError)throw profileError;
          const byId=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
          return {ok:true,data:(data||[]).map(o=>({...o,member:byId[o.user_id]||null}))}; }
      case "adminUpdateOrder": {
        ({error}=await db.rpc("admin_update_order",{p_id:payload.id,p_status:payload.status}));
        if(error) throw error; return {ok:true};
      }
      case "adminReports": {
        const [orders,members,attempts,logs]=await Promise.all([
          db.from("member_orders").select("id,jumlah,status,created_at,paid_at,paket"),
          db.from("member_profiles").select("id,status,jenjang,created_at,berakhir").neq("status","dihapus"),
          db.from("member_tryout_attempts").select("id,skor,selesai_at,user_id"),
          db.from("member_admin_logs").select("*").order("created_at",{ascending:false}).limit(50)
        ]);
        const fail=[orders,members,attempts,logs].find(x=>x.error); if(fail)throw fail.error;
        return {ok:true,data:{orders:orders.data||[],members:members.data||[],attempts:attempts.data||[],logs:logs.data||[]}};
      }
      case "adminAnalisisWordGemini": case "adminBuatSoalGemini": case "adminRapikanSoalGemini": case "adminAsistenSoal": {
        const {data:ai,error:aiError}=await db.functions.invoke("gemini-question-studio",{body:{action,payload:payload||{}}});
        if(aiError) throw aiError;
        if(!ai||ai.ok===false) throw new Error((ai&&ai.error)||"Gemini belum merespons.");
        return ai;
      }
      default: throw new Error("Aksi admin belum dikenali: "+action);
    }
    ({error}=await db.from("member_profiles").update(q).eq("id",payload.id)); if(error) throw error;
    await logAdmin(action,"member",payload.id,q); return {ok:true};
  }
  window.KFSupabaseAdmin = { configured, ensureAdmin, api, client:db };
})();

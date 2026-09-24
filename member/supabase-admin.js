(function () {
  "use strict";
  const cfg = window.KF_SUPABASE_CONFIG || {};
  const demoMode = cfg.demoMode === true && !!window.KFDemo;
  const configured = demoMode || (/^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || "")) &&
    !String(cfg.publishableKey || "").startsWith("GANTI_") && String(cfg.publishableKey || "").length > 20);
  const db = !demoMode && configured && window.supabase ? window.supabase.createClient(cfg.url, cfg.publishableKey) : null;
  const PAYMENT_SETTINGS_PACKAGE = "__PENGATURAN_PEMBAYARAN__";
  let idleTimer = null, idleWarningTimer = null, currentAdminRole = "";

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
    const reset=()=>{clearTimeout(idleTimer);clearTimeout(idleWarningTimer);idleWarningTimer=setTimeout(()=>window.alert("Sesi admin akan berakhir dalam 2 menit karena tidak ada aktivitas."),28*60*1000);idleTimer=setTimeout(async()=>{if(demoMode)window.KFDemo.adminLogout();else if(db)await db.auth.signOut();window.alert("Sesi admin berakhir karena tidak aktif selama 30 menit.");location.reload();},30*60*1000);};
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
  function maskEmail(v){const s=String(v||""),a=s.split("@");return a.length===2?(a[0].slice(0,3)||"***")+"***@"+a[1]:"***";}
  function maskPhone(v){const s=String(v||"").replace(/\D/g,"");return s.length>7?s.slice(0,4)+"****"+s.slice(-4):"****";}
  function showSetup() {
    const layout = document.querySelector(".layout"); if (!layout) return;
    layout.innerHTML = `<main style="width:min(760px,calc(100% - 32px));margin:42px auto"><div class="card" style="padding:28px"><h1>Supabase Belum Dikonfigurasi</h1><p>Buat proyek Supabase, jalankan <code>supabase-setup.sql</code>, lalu isi Project URL dan Publishable Key pada <code>supabase-config.js</code>.</p><p>Ikuti langkah lengkap pada <code>PANDUAN-SUPABASE-MEMBER.md</code>.</p><button class="btn" onclick="location.href='../admin-dashboard-login.html'">Kembali ke Admin Utama</button></div></main>`;
  }
  function showLogin(message) {
    const layout = document.querySelector(".layout"); if (!layout) return;
    layout.innerHTML = `<main style="grid-column:1/-1;width:100%;min-height:calc(100vh - 72px);display:grid;place-items:center;padding:38px 18px;box-sizing:border-box;background:radial-gradient(circle at 18% 12%,rgba(153,41,220,.12),transparent 32%),radial-gradient(circle at 85% 80%,rgba(243,78,165,.12),transparent 34%),#faf7ff">
      <form class="card" style="width:min(460px,100%);box-sizing:border-box;padding:34px;border-radius:24px;box-shadow:0 24px 70px rgba(61,27,102,.18);border:1px solid #eadcf8;background:rgba(255,255,255,.97)" onsubmit="KFLoginAdminMember(event)">
        <div style="width:58px;height:58px;margin:0 auto 15px;border-radius:18px;display:grid;place-items:center;color:#fff;font-size:26px;background:linear-gradient(135deg,#7424ca,#f34ea5);box-shadow:0 12px 28px rgba(148,43,219,.25)">⚙</div>
        <h1 style="text-align:center;margin:0;color:#23103e;font-size:28px">Masuk Admin Member</h1>
        <p style="text-align:center;color:#745d86;margin:8px 0 20px;line-height:1.55">${demoMode?'Kelola peserta, paket, pembayaran, dan konten melalui Mode Demo Lokal.':'Masuk menggunakan akun yang terdaftar sebagai Admin Member.'}</p>
        ${demoMode?'<div style="padding:14px 16px;border:1px solid #dfc9f3;border-radius:14px;background:linear-gradient(135deg,#f7efff,#fff3fa);margin:0 0 18px;color:#4d286c"><div style="font-size:11px;font-weight:900;letter-spacing:.08em;color:#9227c7;margin-bottom:5px">AKUN ADMIN DEMO</div><b>admin.demo@gmail.com</b><br><code style="display:inline-block;margin-top:3px">AdminDemo123!</code></div>':''}
        <label style="display:block;margin:0 0 7px;font-weight:800;color:#32154f">Email Admin</label>
        <input id="kfAdminEmail" type="email" required autocomplete="email" placeholder="admin@email.com" value="${demoMode?'admin.demo@gmail.com':''}" style="display:block;width:100%;height:46px;box-sizing:border-box;margin:0 0 14px;padding:0 13px;border:1px solid #d9c2ee;border-radius:11px;background:#fff;font:inherit;color:#271044;outline:none">
        <label style="display:block;margin:0 0 7px;font-weight:800;color:#32154f">Password</label>
        <div style="position:relative;margin-bottom:18px"><input id="kfAdminPass" type="password" required autocomplete="current-password" value="${demoMode?'AdminDemo123!':''}" style="display:block;width:100%;height:46px;box-sizing:border-box;padding:0 48px 0 13px;border:1px solid #d9c2ee;border-radius:11px;background:#fff;font:inherit;color:#271044;outline:none"><button type="button" onclick="const x=document.getElementById('kfAdminPass');x.type=x.type==='password'?'text':'password';this.textContent=x.type==='password'?'◉':'◎'" aria-label="Tampilkan password" style="position:absolute;right:7px;top:6px;width:34px;height:34px;border:0;border-radius:8px;background:#f5edfc;color:#7424ca;cursor:pointer">◉</button></div>
        <button class="btn" style="width:100%;min-height:46px;border-radius:12px;font-size:14px;box-shadow:0 10px 25px rgba(148,43,219,.22)">Masuk ke Dashboard</button>
        <div id="kfAdminMsg" style="min-height:18px;margin-top:13px;text-align:center;color:#b52652;font-weight:700">${safe(message)}</div>
        <p style="margin:8px 0 0;text-align:center;color:#8a7499;font-size:11px">🔒 Halaman khusus pengelola Member Area</p>
      </form>
    </main>`;
  }
  window.KFLoginAdminMember = async function (e) {
    e.preventDefault();
    const out=document.getElementById("kfAdminMsg"); if(out) out.textContent="Memeriksa…";
    if(demoMode){try{if(!window.KFDemo.adminLogin(document.getElementById("kfAdminEmail").value,document.getElementById("kfAdminPass").value)){if(out)out.textContent="Email atau password admin demo tidak benar.";return;}location.reload();return;}catch(error){if(out)out.textContent=error.message;return;}}
    const { error } = await db.auth.signInWithPassword({ email:document.getElementById("kfAdminEmail").value.trim(), password:document.getElementById("kfAdminPass").value });
    if (error) { if(out) out.textContent=error.message; return; }
    location.reload();
  };
  window.KFLogoutAdminMember = async function () {
    if(demoMode){window.KFDemo.adminLogout();location.reload();return;}
    if (db) await db.auth.signOut();
    location.href="../admin-dashboard-login.html";
  };

  async function ensureAdmin() {
    if (!configured) { showSetup(); return false; }
    if(demoMode){if(!window.KFDemo.adminActive()){showLogin("");return false;}currentAdminRole=window.KFDemo.adminRole();startIdleGuard();return true;}
    const { data:{ session } } = await db.auth.getSession();
    if (!session) { showLogin(""); return false; }
    try{await ensureMfaChallenge();}catch(error){await db.auth.signOut();showLogin("Verifikasi MFA gagal: "+safe(error.message));return false;}
    const { data, error } = await db.from("member_admins").select("user_id,role,active").eq("user_id",session.user.id).eq("active",true).maybeSingle();
    if (error || !data) { await db.auth.signOut(); showLogin("Akun ini tidak mempunyai hak Admin Member."); return false; }
    currentAdminRole=data.role||"content_admin";startIdleGuard();
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
    const standard = ["id","jenjang","jenis","tujuan","topik","judul","visible","archived_at","publication_status","created_at","updated_at","data"];
    const data = { ...(item.data || {}) };
    Object.keys(item).forEach(k => { if (!standard.includes(k)) data[k]=item[k]; });
    const allowedStatus=["draft","review","scheduled","published","archived"];
    data.publication_status=allowedStatus.includes(item.publication_status||data.publication_status)?(item.publication_status||data.publication_status):(item.visible===false?"draft":"published");
    if(item.jenis==="soal")data.package_question_count=Math.max(1,Math.min(100,Number(data.package_question_count)||1));
    return { id:item.id || undefined, jenjang:item.jenjang || "sd", jenis:item.jenis || "soal", tujuan:item.tujuan || null, topik:String(item.topik||"").trim().slice(0,160), judul:String(item.judul||"").trim().slice(0,240), visible:data.publication_status==="published", archived_at:data.publication_status==="archived"?new Date().toISOString():null, data };
  }
  function flatContent(x) { return { ...(x.data || {}), id:x.id, jenjang:x.jenjang, jenis:x.jenis, tujuan:x.tujuan, topik:x.topik, judul:x.judul, visible:x.visible, archived_at:x.archived_at, created_at:x.created_at, updated_at:x.updated_at }; }
  async function logAdmin(aksi,targetType,targetId,detail) {
    const {error}=await db.rpc("log_admin_event",{p_action:aksi,p_target_type:targetType||"",p_target_id:String(targetId||""),p_detail:detail||{}});
    if(error) console.warn("Log admin belum tersimpan:",error.message);
  }

  async function api(action, payload) {
    if(demoMode)return window.KFDemo.api(action,payload||{});
    let q, data, error;
    switch (action) {
      case "adminLogin": return { ok:true };
      case "adminCurrentRole": return {ok:true,data:{role:currentAdminRole}};
      case "adminListAdmins": {
        const out=await db.functions.invoke("admin-user-management",{body:{action:"list"}});if(out.error)throw out.error;if(!out.data?.ok)throw new Error(out.data?.error||"Daftar admin gagal dimuat");return out.data;
      }
      case "adminCreateContentAdmin": {
        await ensureMfaChallenge();const out=await db.functions.invoke("admin-user-management",{body:{action:"create",...payload}});if(out.error)throw out.error;if(!out.data?.ok)throw new Error(out.data?.error||"Admin baru gagal dibuat");return out.data;
      }
      case "adminSetAdminActive": {
        await ensureMfaChallenge();const out=await db.functions.invoke("admin-user-management",{body:{action:"set_active",...payload}});if(out.error)throw out.error;if(!out.data?.ok)throw new Error(out.data?.error||"Status admin gagal diubah");return out.data;
      }
      case "adminListMember":
        ({data,error}=await db.rpc("admin_list_members_masked"));
        if(error) throw error; return {ok:true,data:(data||[]).map(x=>({...x,email:maskEmail(x.email),wa:maskPhone(x.wa)}))};
      case "adminListPaket":
        ({data,error}=await db.from("member_packages").select("*").order("harga"));
        if(error) throw error; return {ok:true,data:(data||[]).filter(p=>p.nama!==PAYMENT_SETTINGS_PACKAGE).map(p=>({...p,durasiHari:p.durasi_hari}))};
      case "adminSimpanPaket": {
        const p=payload.item||{};
        p.nama=String(p.nama||"").trim();p.deskripsi=String(p.deskripsi||"").trim();
        const days=Number(p.durasiHari),price=Number(p.harga);
        if(p.nama.length<3||p.nama.length>80)throw new Error("Nama paket harus 3–80 karakter.");
        if(!Number.isInteger(days)||days<1||days>3650)throw new Error("Durasi paket harus 1–3650 hari.");
        if(!Number.isSafeInteger(price)||price<0||price>1000000000)throw new Error("Harga paket tidak valid.");
        if(p.deskripsi.length<5||p.deskripsi.length>1500)throw new Error("Deskripsi paket harus 5–1500 karakter.");
        ({error}=await db.from("member_packages").upsert({nama:p.nama,durasi_hari:days,harga:price,deskripsi:p.deskripsi,aktif:p.aktif!==false},{onConflict:"nama"}));
        if(error) throw error; await logAdmin("simpan_paket","paket",p.nama,{harga:p.harga,durasiHari:p.durasiHari}); return {ok:true};
      }
      case "adminHapusPaket": ({error}=await db.from("member_packages").update({aktif:false}).eq("nama",payload.nama));if(error)throw error;await logAdmin("sembunyikan_paket","paket",payload.nama,{});return {ok:true};
      case "adminAktifkanPaket": ({error}=await db.from("member_packages").update({aktif:true}).eq("nama",payload.nama));if(error)throw error;await logAdmin("aktifkan_paket","paket",payload.nama,{});return {ok:true};
      case "adminGetPaymentSettings": {
        ({data,error}=await db.from("member_packages").select("deskripsi").eq("nama",PAYMENT_SETTINGS_PACKAGE).maybeSingle());
        if(error) throw error;
        return {ok:true,data:normalizePaymentSettings(data&&data.deskripsi)};
      }
      case "adminSavePaymentSettings": {
        await ensureMfaChallenge();
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
        await ensureMfaChallenge();
        ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"activate",p_package:payload.paket,p_note:""}));
        if(error) throw error; return {ok:true};
      }
      case "adminTolak": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"reject",p_package:"",p_note:payload.catatan||""})); if(error)throw error; return {ok:true};
      case "adminAktifkanKembali": ({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"reactivate",p_package:"",p_note:""})); if(error)throw error; return {ok:true};
      case "adminNonaktifkan": await ensureMfaChallenge();({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"deactivate",p_package:"",p_note:payload.catatan||""})); if(error)throw error; return {ok:true};
      case "adminHapusMember": await ensureMfaChallenge();({error}=await db.rpc("admin_update_member",{p_id:payload.id,p_action:"soft_delete",p_package:"",p_note:payload.catatan||""})); if(error)throw error; return {ok:true};
      case "adminListKonten":
        ({data,error}=await db.from("member_content").select("*").order("created_at")); if(error) throw error; return {ok:true,data:(data||[]).map(flatContent)};
      case "adminSimpanKonten": {
        const row=cleanContent(payload.item||{}); if(!row.id) delete row.id;
        ({data,error}=await db.from("member_content").upsert(row).select().single()); if(error) throw error;
        await logAdmin(row.id?"ubah_konten":"buat_konten","konten",data.id,{judul:data.judul,status:data.data.publication_status});return {ok:true,data:flatContent(data)};
      }
      case "adminHapusKonten":
        await ensureMfaChallenge();
        ({data,error}=await db.from("member_content").select("data,judul").eq("id",payload.id).single());if(error)throw error;
        ({error}=await db.from("member_content").update({visible:false,archived_at:new Date().toISOString(),data:{...(data.data||{}),publication_status:"archived",archive_reason:String(payload.reason||"").slice(0,500)}}).eq("id",payload.id)); if(error) throw error; await logAdmin("arsip_konten","konten",payload.id,{judul:data.judul,alasan:payload.reason||""}); return {ok:true};
      case "adminPulihkanKonten":
        ({data,error}=await db.from("member_content").select("data,judul").eq("id",payload.id).single());if(error)throw error;
        ({error}=await db.from("member_content").update({visible:false,archived_at:null,data:{...(data.data||{}),publication_status:"draft"}}).eq("id",payload.id));if(error)throw error;await logAdmin("pulihkan_konten","konten",payload.id,{judul:data.judul});return {ok:true};
      case "adminVersiKonten":
        ({data,error}=await db.from("member_content_versions").select("version_no,change_reason,created_at,changed_by").eq("content_id",payload.id).order("version_no",{ascending:false}).limit(30));if(error)throw error;return {ok:true,data:data||[]};
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
        {const content=await db.from("member_content").select("id,visible,archived_at,data");if(content.error)throw content.error;return {ok:true,data:{orders:orders.data||[],members:members.data||[],attempts:attempts.data||[],logs:logs.data||[],content:content.data||[]}};}
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
  window.KFSupabaseAdmin = { configured, demoMode, ensureAdmin, api, client:db, getRole:()=>currentAdminRole };
})();

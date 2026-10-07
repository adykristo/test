// KlinikFisikapku Member Area — Supabase Auth V2
(function () {
  const cfg = window.KF_SUPABASE_CONFIG;
  if (!cfg || cfg.isValid === false || !cfg.url || !cfg.anonKey || cfg.url.indexOf("GANTI_") >= 0 || cfg.anonKey.indexOf("GANTI_") >= 0) {
    console.error("Konfigurasi Supabase belum diisi.");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS SDK belum dimuat.");
    return;
  }

  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
  const PROFILE_FIELDS = "id,email,nama,username,kelas,wa,sekolah,jenjang,paket,status,berakhir,tahap_terbuka,created_at,updated_at";

  function clean(v) { return String(v == null ? "" : v).trim(); }
  function gmail(v) { return clean(v).toLowerCase(); }
  function flattenContent(item) {
    if (!item || typeof item !== "object") return item;
    const data = item.data && typeof item.data === "object" ? item.data : {};
    const flat = Object.assign({}, item, data);
    delete flat.data;
    flat.learning_stage = Number(flat.learning_stage) || 1;
    return flat;
  }

  async function usernameAvailable(username) {
    const u = clean(username).toLowerCase();
    if (!/^[a-z0-9._]{4,30}$/.test(u)) return false;
    const { data, error } = await supabase.rpc("kf_username_available", { p_username: u });
    if (error) throw new Error("Pemeriksaan username gagal. Pastikan SQL instalasi terbaru sudah dijalankan.");
    return data === true;
  }

  window.api = async function (action, payload) {
    payload = payload || {};
    if (action === "daftar") {
      const email = gmail(payload.email);
      const username = clean(payload.username).toLowerCase();
      const kelas = clean(payload.kelas);
      const jenjang = clean(payload.jenjang).toLowerCase();
      if (!/^[^@\s]+@gmail\.com$/.test(email)) throw new Error("Gunakan alamat Gmail (@gmail.com).");
      if (!/^[a-z0-9._]{4,30}$/.test(username)) throw new Error("Username 4–30 karakter: huruf kecil, angka, titik, atau underscore.");
      if (!/^(1|2|3|4|5|6|7|8|9|10|11|12)$/.test(kelas)) throw new Error("Kelas tidak valid.");
      if (!["sd","smp","sma"].includes(jenjang)) throw new Error("Jenjang tidak valid.");
      if (!(await usernameAvailable(username))) throw new Error("Username sudah digunakan. Silakan pilih username lain.");

      const { data, error } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: { data: {
          nama: clean(payload.nama), username, sekolah: clean(payload.sekolah),
          kelas, jenjang, wa: clean(payload.wa), paket: clean(payload.paket)
        }}
      });
      if (error) {
        const m = String(error.message || "");
        if (/already|registered|exists/i.test(m)) throw new Error("Email tersebut sudah terdaftar. Silakan masuk atau gunakan Lupa Password.");
        if (/database error/i.test(m)) throw new Error("Database gagal membuat profil. Jalankan 01-INSTALL-DATABASE.sql versi paket ini dan pastikan username belum digunakan.");
        if (/confirmation email|sending/i.test(m)) throw new Error("Akun belum dapat dibuat karena email verifikasi gagal dikirim. Periksa SMTP Brevo/Supabase.");
        throw new Error(m || "Pendaftaran gagal.");
      }
      return { ok:true, user:data && data.user ? {id:data.user.id,email:data.user.email}:null, needsEmailConfirmation:!(data && data.session) };
    }

    if (action === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email:gmail(payload.username || payload.email), password:payload.password });
      if (error) throw new Error("Email atau password salah, atau email belum dikonfirmasi.");
      const res = await supabase.from("member_profiles").select(PROFILE_FIELDS).eq("id", data.user.id).single();
      if (res.error) throw new Error("Profil member gagal dimuat: " + res.error.message);
      if (res.data.status === "dihapus") { await supabase.auth.signOut(); throw new Error("Akun ini telah dihapus."); }
      return { ok:true, member:res.data };
    }
    throw new Error("Aksi publik tidak dikenali: " + action);
  };

  window.KFMemberAuth = {
    configured:true, client:supabase,
    updateProfil: async function(input){
      const {data:u,error:ue}=await supabase.auth.getUser();
      if(ue||!u||!u.user) throw new Error("Sesi peserta sudah berakhir.");
      const current=await supabase.from("member_profiles").select("username").eq("id",u.user.id).single();
      if(current.error) throw current.error;
      const nama=clean(input.nama), sekolah=clean(input.sekolah), wa=clean(input.wa);
      const kelas=clean(input.kelas), jenjang=clean(input.jenjang).toLowerCase();
      const username=clean(input.username).toLowerCase();
      if(!nama||!sekolah||!wa) throw new Error("Nama, sekolah, dan WhatsApp wajib diisi.");
      if(!/^[a-z0-9._]{4,30}$/.test(username)) throw new Error("Username 4–30 karakter: huruf kecil, angka, titik, atau underscore.");
      if(!/^(1|2|3|4|5|6|7|8|9|10|11|12)$/.test(kelas)) throw new Error("Kelas tidak valid.");
      if(!["sd","smp","sma"].includes(jenjang)) throw new Error("Jenjang tidak valid.");
      if(username!==String(current.data.username||"").toLowerCase() && !(await usernameAvailable(username))) throw new Error("Username sudah digunakan.");
      const {data,error}=await supabase.from("member_profiles").update({nama,username,sekolah,wa,kelas,jenjang}).eq("id",u.user.id).select(PROFILE_FIELDS).single();
      if(error) throw error;
      return {ok:true,data};
    },
    listPaket: async function () {
      const {data,error}=await supabase.rpc("kf_member_package_catalog");
      if(error) throw error;
      return {ok:true,data:(data||[]).map(p=>({
        id:p.package_id,
        nama:p.nama,
        durasiHari:p.durasi_hari,
        harga:p.harga,
        deskripsi:p.deskripsi,
        jenjang:(p.jenjang||((String(p.nama||"").match(/^(SD|SMP|SMA)\b/i)||[])[1])||"").toUpperCase(),
        kode:p.kode||"",
        // RPC kf_member_package_catalog returns ownership as owned_status
        // ("active", "pending", "expired", "locked"), not a boolean owned field.
        owned:String(p.owned_status||"").toLowerCase()==="active",
        ownedStatus:String(p.owned_status||"locked").toLowerCase(),
        expiresAt:p.expires_at||null
      }))};
    },
    paketSaya: async function(){
      const r=await this.listPaket();
      return {ok:true,data:(r.data||[]).filter(p=>p.owned)};
    },
    topikSaya: async function(){
      const {data,error}=await supabase.rpc("kf_member_topics");
      if(error) throw error;
      return {ok:true,data:(data||[]).map(t=>({
        id:t.topic_id, package_id:t.package_id, package_name:t.package_name,
        judul:t.judul, deskripsi:t.deskripsi, urutan:t.urutan
      }))};
    },
    metodePembayaran: async function(){
      const {data,error}=await supabase.rpc("kf_payment_methods");
      if(error) throw error;
      return {ok:true,data:(data||[]).map(m=>({
        id:m.id, jenis:m.jenis, nama:m.nama, nomor_akun:m.nomor_akun,
        pemilik:m.pemilik, whatsapp:m.whatsapp, instruksi:m.instruksi,
        qr_image:m.qr_image, urutan:m.urutan
      }))};
    },
    buatOrderPaket: async function(packageId,paymentMethodId){
      const {data,error}=await supabase.rpc("kf_create_package_order",{
        p_package:packageId,p_payment_method:paymentMethodId||null
      });
      if(error) throw error;
      return {ok:true,id:data};
    },
    quoteBundle: async function(packageIds){const {data,error}=await supabase.rpc("kf_bundle_quote",{p_package_ids:packageIds});if(error)throw error;return {ok:true,data:(data||[])[0]||{package_count:0,subtotal:0,discount_percent:0,discount_amount:0,total_amount:0}};},
    buatOrderBundle: async function(packageIds,paymentMethodId){const {data,error}=await supabase.rpc("kf_create_bundle_order",{p_package_ids:packageIds,p_payment_method:paymentMethodId||null});if(error)throw error;return {ok:true,id:data};},
    orderBundleSaya: async function(){
      const {data:u,error:ue}=await supabase.auth.getUser();if(ue||!u.user)throw new Error("Sesi peserta berakhir.");
      const {data,error}=await supabase.from("member_bundle_orders").select("*").eq("user_id",u.user.id).order("created_at",{ascending:false}).limit(20);
      if(error)throw error;
      const orders=data||[],ids=orders.map(x=>x.id);let items=[];
      if(ids.length){const q=await supabase.from("member_bundle_order_items").select("*").in("order_id",ids);if(!q.error)items=q.data||[];}
      return {ok:true,data:orders.map(o=>({...o,items:items.filter(i=>i.order_id===o.id)}))};
    },
    batalkanOrderBundle: async function(orderId){
      const {data:u,error:ue}=await supabase.auth.getUser();if(ue||!u.user)throw new Error("Sesi peserta berakhir.");
      const {data,error}=await supabase.from("member_bundle_orders").update({status:"cancelled"}).eq("id",orderId).eq("user_id",u.user.id).eq("status","pending").select("id,status");
      if(error)throw error;if(!data||!data.length)throw new Error("Permintaan tidak dapat dibatalkan. Mungkin sudah diproses Admin.");
      return {ok:true};
    },
    signedLearningFile: async function(storagePath){
      const path=clean(storagePath);
      if(!path) return "";
      if(path.includes("..") || path.startsWith("/") || !/^[0-9a-f-]{36}\//i.test(path)) throw new Error("Path file belajar tidak valid.");
      const {data,error}=await supabase.storage.from("learning-files-private").createSignedUrl(path,600);
      if(error) throw error;
      return data&&data.signedUrl ? data.signedUrl : "";
    },
    kontenMember: async function(jenjang){
      const wanted=clean(jenjang).toLowerCase();
      // SECURITY: fail closed. Konten member hanya boleh berasal dari RPC server
      // yang menerapkan entitlement paket. Tidak ada fallback SELECT member_content.
      const {data,error}=await supabase.rpc("kf_member_content_v2");
      if(error) throw error;
      const list=(Array.isArray(data)?data:[]).map(flattenContent).filter(function(x){
        const jenis=clean(x&&x.jenis).toLowerCase();
        const tujuan=clean(x&&x.tujuan).toLowerCase();
        // Mesin latihan/tryout interaktif hanya melalui engine V15.
        // PENGECUALIAN: Latihan PDF adalah konten belajar biasa, bukan engine soal interaktif,
        // sehingga tetap harus tampil jika RPC server sudah mengizinkan paket peserta.
        const sourceType=clean(x&&x.source_type).toLowerCase();
        const hasPdf=!!clean(x&&(x.pdfUrl||x.pdf_url||x.file_url));
        const isLatihanPdf=jenis==="soal" && (sourceType==="pdf"||hasPdf) && tujuan!=="tryout";
        return isLatihanPdf || (
          !["soal","quiz","question","qset","tryout"].includes(jenis)
          && tujuan!=="tryout"
        );
      });
      const filtered=wanted
        ? list.filter(x=>clean(x&&x.jenjang).toLowerCase()===wanted)
        : list;
      return {ok:true,data:filtered};
    },
    dataBelajar: async function(){
      const {data:s}=await supabase.auth.getSession(); if(!s.session)return {progress:[],bookmarks:[],attempts:[],certificates:[]};
      const uid=s.session.user.id;
      const r=await Promise.all([supabase.from("member_progress").select("*").eq("user_id",uid),supabase.from("member_bookmarks").select("*").eq("user_id",uid)]);
      // Riwayat Latihan/Tryout tidak lagi membaca member_answer_attempts legacy.
      return {progress:r[0].data||[],bookmarks:r[1].data||[],attempts:[],certificates:[]};
    },
    cekJawaban: async function(){
      throw new Error("Latihan interaktif legacy dinonaktifkan. Gunakan Paket Latihan & Tryout V15.");
    },
    simpanProgress: async function(contentId,state){if(!contentId)return {ok:false};if(String(contentId).indexOf("qset:")===0)return {ok:true,state:state||null};const {error}=await supabase.rpc("touch_member_content",{p_content_id:contentId});if(error)throw error;return {ok:true,state:state||null};},
    setBookmark: async function(contentId,aktif){const {data:u}=await supabase.auth.getUser();const user=u&&u.user;if(!user)return;if(aktif){const {error}=await supabase.from("member_bookmarks").upsert({user_id:user.id,content_id:contentId},{onConflict:"user_id,content_id"});if(error)throw error;}else{const {error}=await supabase.from("member_bookmarks").delete().match({user_id:user.id,content_id:contentId});if(error)throw error;}return {ok:true};}
  };

  window.addEventListener("DOMContentLoaded", async function(){
    const {data:s}=await supabase.auth.getSession();
    if(s.session && document.getElementById("dash")){
      const user=s.session.user;
      const {data:p,error:pe}=await supabase.from("member_profiles").select(PROFILE_FIELDS).eq("id",user.id).maybeSingle();

      // Google OAuth hanya untuk MASUK, bukan pendaftaran otomatis.
      // Profil hasil pendaftaran resmi selalu mempunyai biodata inti ini.
      // Trigger Supabase boleh saja membuat row profil untuk auth.users baru,
      // tetapi row kosong/tidak lengkap tidak dianggap sebagai peserta terdaftar.
      const providers=(user.app_metadata&&Array.isArray(user.app_metadata.providers))
        ? user.app_metadata.providers.map(x=>String(x).toLowerCase())
        : [];
      const viaGoogle=providers.includes("google") || String(user.app_metadata&&user.app_metadata.provider||"").toLowerCase()==="google";
      const profilTerdaftar=!!(p &&
        clean(p.email) &&
        clean(p.nama) &&
        clean(p.username) &&
        clean(p.sekolah) &&
        clean(p.wa) &&
        /^(1|2|3|4|5|6|7|8|9|10|11|12)$/.test(clean(p.kelas)) &&
        ["sd","smp","sma"].includes(clean(p.jenjang).toLowerCase()));

      if(viaGoogle && (!profilTerdaftar || pe)){
        await supabase.auth.signOut();
        try{localStorage.removeItem("kf_member_profile");}catch(_){}
        if(typeof buka==="function")buka("login");
        const msg="Akun Google ini belum terdaftar sebagai peserta KlinikFisikapku. Silakan Daftar terlebih dahulu.";
        if(window.KFMemberUI&&typeof KFMemberUI.toast==="function")KFMemberUI.toast(msg,"err",7000);
        const n=document.getElementById("loginNotice");
        if(n){n.textContent=msg;n.className="auth-notice show err";}
        return;
      }

      if(p && p.status==="dihapus"){
        await supabase.auth.signOut();
        if(typeof buka==="function")buka("login");
        return;
      }
      if(p && typeof masukPeserta==="function"){
        const d=document.getElementById("dash");
        if(d&&window.getComputedStyle(d).display==="none")masukPeserta(p);
      }
    }
  });

  function showRecoveryForm(){
    if(document.getElementById("kfRecoveryOverlay")) return;
    const wrap=document.createElement("div");
    wrap.id="kfRecoveryOverlay";
    wrap.style.cssText="position:fixed;inset:0;z-index:200000;background:linear-gradient(135deg,#eef2ff,#f8f5ff 50%,#effcf9);display:grid;place-items:center;padding:18px";
    wrap.innerHTML='<div style="width:min(430px,100%);background:#fff;border:1px solid #e3d5ef;border-radius:18px;padding:25px;box-shadow:0 18px 50px rgba(55,30,86,.18)"><h2 style="margin:0 0 6px;text-align:center;color:#28143c">Buat Password Baru 🔐</h2><p style="margin:0 0 18px;text-align:center;color:#6b5680;font-size:13px">Masukkan password baru untuk akun KlinikFisikapku Anda.</p><label style="display:block;font-weight:700;font-size:12px;margin:10px 0 5px;color:#402065">Password baru</label><input id="kfNewPassword" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:11px;border:1px solid #e7d8f5;border-radius:9px;font-size:14px"><label style="display:block;font-weight:700;font-size:12px;margin:12px 0 5px;color:#402065">Ulangi password baru</label><input id="kfNewPassword2" type="password" autocomplete="new-password" minlength="8" style="width:100%;padding:11px;border:1px solid #e7d8f5;border-radius:9px;font-size:14px"><div id="kfRecoveryMsg" style="display:none;margin-top:12px;padding:10px;border-radius:9px;font-size:13px"></div><button id="kfSaveNewPassword" type="button" style="width:100%;margin-top:16px;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer;background:linear-gradient(100deg,#822bd9,#f34ea5);color:#fff">Simpan Password Baru</button></div>';
    document.body.appendChild(wrap);
    document.getElementById("kfSaveNewPassword").onclick=async function(){
      const p1=document.getElementById("kfNewPassword").value;
      const p2=document.getElementById("kfNewPassword2").value;
      const msg=document.getElementById("kfRecoveryMsg");
      const btn=this;
      const notice=(t,ok)=>{msg.style.display="block";msg.style.background=ok?"#e8f8ef":"#fff0f3";msg.style.color=ok?"#147343":"#b4284f";msg.textContent=t;};
      if(p1.length<8){notice("Password minimal 8 karakter.",false);return;}
      if(p1!==p2){notice("Ulangi password harus sama.",false);return;}
      btn.disabled=true;btn.textContent="Menyimpan...";
      const {error}=await supabase.auth.updateUser({password:p1});
      if(error){notice("Gagal menyimpan password: "+error.message,false);btn.disabled=false;btn.textContent="Simpan Password Baru";return;}
      notice("Password berhasil diubah. Anda akan diarahkan ke halaman masuk.",true);
      await supabase.auth.signOut();
      setTimeout(()=>{history.replaceState(null,"",window.location.pathname);window.location.reload();},1200);
    };
  }

  supabase.auth.onAuthStateChange(function(event){
    if(event==="PASSWORD_RECOVERY") setTimeout(showRecoveryForm,0);
  });

  function showRecoveryOtpForm(email){
    const old=document.getElementById("kfRecoveryOtpOverlay"); if(old) old.remove();
    const wrap=document.createElement("div");
    wrap.id="kfRecoveryOtpOverlay";
    wrap.style.cssText="position:fixed;inset:0;z-index:200000;background:rgba(32,14,55,.38);display:grid;place-items:center;padding:18px";
    wrap.innerHTML='<div style="width:min(430px,100%);background:#fff;border:1px solid #e3d5ef;border-radius:18px;padding:25px;box-shadow:0 18px 50px rgba(55,30,86,.22)"><h2 style="margin:0 0 6px;text-align:center;color:#28143c">Masukkan Kode Pemulihan 🔐</h2><p style="margin:0 0 18px;text-align:center;color:#6b5680;font-size:13px">Kami mengirim kode pemulihan ke email Anda. Masukkan kode dari email terbaru.</p><label style="display:block;font-weight:700;font-size:12px;margin:10px 0 5px;color:#402065">Email</label><input id="kfRecoveryEmail" type="email" autocomplete="email" style="width:100%;padding:11px;border:1px solid #e7d8f5;border-radius:9px;font-size:14px" value="'+String(email||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")+'"><label style="display:block;font-weight:700;font-size:12px;margin:12px 0 5px;color:#402065">Kode pemulihan</label><input id="kfRecoveryOtp" inputmode="numeric" autocomplete="one-time-code" style="width:100%;padding:11px;border:1px solid #e7d8f5;border-radius:9px;font-size:18px;letter-spacing:3px;text-align:center" placeholder="Masukkan kode"><div id="kfRecoveryOtpMsg" style="display:none;margin-top:12px;padding:10px;border-radius:9px;font-size:13px"></div><button id="kfVerifyRecoveryOtp" type="button" style="width:100%;margin-top:16px;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer;background:linear-gradient(100deg,#822bd9,#f34ea5);color:#fff">Verifikasi Kode</button><button id="kfCloseRecoveryOtp" type="button" style="width:100%;margin-top:8px;border:0;background:transparent;color:#6b5680;cursor:pointer;padding:8px">Tutup</button></div>';
    document.body.appendChild(wrap);
    document.getElementById("kfCloseRecoveryOtp").onclick=()=>wrap.remove();
    document.getElementById("kfVerifyRecoveryOtp").onclick=async function(){
      const e=gmail(document.getElementById("kfRecoveryEmail").value);
      const token=(document.getElementById("kfRecoveryOtp").value||"").trim().replace(/\s+/g,"");
      const msg=document.getElementById("kfRecoveryOtpMsg"),btn=this;
      const notice=(t,ok)=>{msg.style.display="block";msg.style.background=ok?"#e8f8ef":"#fff0f3";msg.style.color=ok?"#147343":"#b4284f";msg.textContent=t;};
      if(!e||!token){notice("Email dan kode pemulihan wajib diisi.",false);return;}
      btn.disabled=true;btn.textContent="Memverifikasi...";
      const {error}=await supabase.auth.verifyOtp({email:e,token:token,type:"recovery"});
      if(error){notice("Kode tidak valid atau sudah kedaluwarsa. Gunakan kode dari email terbaru.",false);btn.disabled=false;btn.textContent="Verifikasi Kode";return;}
      wrap.remove(); showRecoveryForm();
    };
  }

  window.kirimResetPassword=async function(){
    const el=document.getElementById("user")||document.getElementById("email");
    const e=el?gmail(el.value):"";
    if(!e){alert("Masukkan alamat email Anda terlebih dahulu.");return;}
    const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin+window.location.pathname});
    if(error){alert("Gagal mengirim kode pemulihan: "+error.message);return;}
    showRecoveryOtpForm(e);
  };
})();

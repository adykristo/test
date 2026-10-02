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
        if (/database error/i.test(m)) throw new Error("Database gagal membuat profil. Jalankan V15-INSTALL-SUPABASE-FINAL-AUDITED.sql versi paket ini dan pastikan username belum digunakan.");
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
    listPaket: async function () {
      const {data,error}=await supabase.from("member_packages").select("*").eq("aktif",true).order("harga",{ascending:true});
      if(error) throw error;
      return {ok:true,data:(data||[]).filter(p=>p.nama!=="_PAYMENT_CONFIG_" && p.nama!=="__PENGATURAN_PEMBAYARAN__").map(p=>({nama:p.nama,durasiHari:p.durasi_hari,harga:p.harga,deskripsi:p.deskripsi,aktif:p.aktif}))};
    },
    kontenMember: async function(jenjang){
      const results=await Promise.all([supabase.rpc("member_secure_content"),supabase.rpc("kf_member_question_content")]);
      if(results[0].error) throw results[0].error;
      const list=(results[0].data||[]).map(flattenContent).concat(results[1].error?[]:(results[1].data||[]).map(flattenContent));
      return {ok:true,data:jenjang?list.filter(x=>x.jenjang===jenjang):list};
    },
    dataBelajar: async function(){
      const {data:s}=await supabase.auth.getSession(); if(!s.session)return {progress:[],bookmarks:[],attempts:[],certificates:[]};
      const uid=s.session.user.id;
      const r=await Promise.all([supabase.from("member_progress").select("*").eq("user_id",uid),supabase.from("member_bookmarks").select("*").eq("user_id",uid),supabase.from("member_answer_attempts").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(30)]);
      return {progress:r[0].data||[],bookmarks:r[1].data||[],attempts:r[2].data||[],certificates:[]};
    },
    cekJawaban: async function(contentId,jawaban){
      if(String(contentId||"").indexOf("qset:")===0){const p=String(contentId).split(":");let n;if(Array.isArray(jawaban))n=jawaban.map(v=>typeof v==="number"?"ABCDE"[v]:String(v));else if(typeof jawaban==="number")n=["ABCDE"[jawaban]];else n=[String(jawaban)];const {data,error}=await supabase.rpc("kf_check_set_answer",{p_set_id:p[1],p_question_id:p[2],p_answer:n});if(error)throw error;return data;}
      const {data,error}=await supabase.rpc("check_member_answer",{p_content_id:contentId,p_answer:jawaban});if(error)throw error;return data;
    },
    simpanProgress: async function(contentId,state){if(!contentId)return {ok:false};if(String(contentId).indexOf("qset:")===0)return {ok:true,state:state||null};const {error}=await supabase.rpc("touch_member_content",{p_content_id:contentId});if(error)throw error;return {ok:true,state:state||null};},
    setBookmark: async function(contentId,aktif){const {data:u}=await supabase.auth.getUser();const user=u&&u.user;if(!user)return;if(aktif){const {error}=await supabase.from("member_bookmarks").upsert({user_id:user.id,content_id:contentId},{onConflict:"user_id,content_id"});if(error)throw error;}else{const {error}=await supabase.from("member_bookmarks").delete().match({user_id:user.id,content_id:contentId});if(error)throw error;}return {ok:true};}
  };

  window.addEventListener("DOMContentLoaded", async function(){
    const {data:s}=await supabase.auth.getSession();
    if(s.session && document.getElementById("dash")){
      const {data:p}=await supabase.from("member_profiles").select(PROFILE_FIELDS).eq("id",s.session.user.id).single();
      if(p && typeof masukPeserta==="function"){const d=document.getElementById("dash");if(d&&window.getComputedStyle(d).display==="none")masukPeserta(p);}
    }
    supabase.from("member_packages").select("deskripsi").eq("nama","_PAYMENT_CONFIG_").maybeSingle().then(function(res){
      const d=res.data;if(!d||!d.deskripsi)return;try{const pay=JSON.parse(d.deskripsi);[["paymentBank",pay.bank],["paymentAccountNumber",pay.nomorRekening],["paymentAccountOwner",pay.pemilikRekening]].forEach(x=>{const e=document.getElementById(x[0]);if(e)e.textContent=x[1]||"-";});const w=document.getElementById("paymentWhatsAppLink");if(w&&pay.whatsapp){let pkt="Paket";try{const p=JSON.parse(localStorage.getItem("kf_member_profile")||"null");if(p&&p.paket)pkt=p.paket;}catch(e){}w.href="https://wa.me/"+pay.whatsapp+"?text="+encodeURIComponent("Halo Admin KlinikFisikapku, saya ingin mengirim bukti transfer untuk aktivasi Member Area.\n\nPaket: "+pkt);}}catch(e){}
    });
  });

  window.kirimResetPassword=async function(){const el=document.getElementById("user")||document.getElementById("email");const e=el?gmail(el.value):"";if(!e){alert("Masukkan alamat Email Google Anda terlebih dahulu.");return;}const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin+window.location.pathname+"#reset"});alert(error?"Gagal mengirim link reset: "+error.message:"Link pemulihan password telah dikirim ke email Anda.");};
})();

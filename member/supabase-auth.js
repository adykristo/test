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
        return !["soal","quiz","question","qset","tryout"].includes(jenis)
          && tujuan!=="tryout";
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
      const {data:p}=await supabase.from("member_profiles").select(PROFILE_FIELDS).eq("id",s.session.user.id).single();
      if(p && typeof masukPeserta==="function"){const d=document.getElementById("dash");if(d&&window.getComputedStyle(d).display==="none")masukPeserta(p);}
    }
    supabase.from("member_packages").select("deskripsi").eq("nama","_PAYMENT_CONFIG_").maybeSingle().then(function(res){
      const d=res.data;if(!d||!d.deskripsi)return;try{const pay=JSON.parse(d.deskripsi);[["paymentBank",pay.bank],["paymentAccountNumber",pay.nomorRekening],["paymentAccountOwner",pay.pemilikRekening]].forEach(x=>{const e=document.getElementById(x[0]);if(e)e.textContent=x[1]||"-";});const w=document.getElementById("paymentWhatsAppLink");if(w&&pay.whatsapp){let pkt="Paket";try{const p=JSON.parse(localStorage.getItem("kf_member_profile")||"null");if(p&&p.paket)pkt=p.paket;}catch(e){}w.href="https://wa.me/"+pay.whatsapp+"?text="+encodeURIComponent("Halo Admin KlinikFisikapku, saya ingin mengirim bukti transfer untuk aktivasi Member Area.\n\nPaket: "+pkt);}}catch(e){}
    });
  });

  window.kirimResetPassword=async function(){const el=document.getElementById("user")||document.getElementById("email");const e=el?gmail(el.value):"";if(!e){alert("Masukkan alamat Email Google Anda terlebih dahulu.");return;}const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin+window.location.pathname+"#reset"});alert(error?"Gagal mengirim link reset: "+error.message:"Link pemulihan password telah dikirim ke email Anda.");};
})();

(function () {
  "use strict";
  const cfg = window.KF_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || "")) &&
    !String(cfg.publishableKey || "").startsWith("GANTI_") && String(cfg.publishableKey || "").length > 20;
  const db = configured && window.supabase ? window.supabase.createClient(cfg.url, cfg.publishableKey) : null;

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
    const { data, error } = await db.from("member_admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if (error || !data) { await db.auth.signOut(); showLogin("Akun ini tidak mempunyai hak Admin Member."); return false; }
    return true;
  }
  function cleanContent(item) {
    const standard = ["id","jenjang","jenis","tujuan","topik","judul","visible","created_at","updated_at","data"];
    const data = { ...(item.data || {}) };
    Object.keys(item).forEach(k => { if (!standard.includes(k)) data[k]=item[k]; });
    return { id:item.id || undefined, jenjang:item.jenjang || "sd", jenis:item.jenis || "soal", tujuan:item.tujuan || null, topik:item.topik || "", judul:item.judul || "", visible:item.visible !== false, data };
  }
  function flatContent(x) { return { ...(x.data || {}), id:x.id, jenjang:x.jenjang, jenis:x.jenis, tujuan:x.tujuan, topik:x.topik, judul:x.judul, visible:x.visible, created_at:x.created_at }; }

  async function api(action, payload) {
    let q, data, error;
    switch (action) {
      case "adminLogin": return { ok:true };
      case "adminListMember":
        ({data,error}=await db.from("member_profiles").select("*").neq("status","dihapus").order("created_at",{ascending:false}));
        if(error) throw error; return {ok:true,data:data||[]};
      case "adminListPaket":
        ({data,error}=await db.from("member_packages").select("*").order("harga"));
        if(error) throw error; return {ok:true,data:(data||[]).map(p=>({...p,durasiHari:p.durasi_hari}))};
      case "adminSimpanPaket": {
        const p=payload.item||{};
        ({error}=await db.from("member_packages").upsert({nama:p.nama,durasi_hari:Number(p.durasiHari)||30,harga:Number(p.harga)||0,deskripsi:p.deskripsi||"",aktif:true},{onConflict:"nama"}));
        if(error) throw error; return {ok:true};
      }
      case "adminVerifikasi": {
        const {data:p,error:pe}=await db.from("member_packages").select("durasi_hari").eq("nama",payload.paket).maybeSingle(); if(pe) throw pe;
        const akhir=new Date(); akhir.setDate(akhir.getDate()+Number((p&&p.durasi_hari)||30));
        ({error}=await db.from("member_profiles").update({status:"aktif",paket:payload.paket,berakhir:akhir.toISOString()}).eq("id",payload.id));
        if(error) throw error; return {ok:true};
      }
      case "adminTolak": q={status:"ditolak",catatan_admin:payload.catatan||""}; break;
      case "adminAktifkanKembali": q={status:"aktif"}; break;
      case "adminNonaktifkan": q={status:"nonaktif"}; break;
      case "adminHapusMember": q={status:"dihapus"}; break;
      case "adminListKonten":
        ({data,error}=await db.from("member_content").select("*").order("created_at")); if(error) throw error; return {ok:true,data:(data||[]).map(flatContent)};
      case "adminSimpanKonten": {
        const row=cleanContent(payload.item||{}); if(!row.id) delete row.id;
        ({data,error}=await db.from("member_content").upsert(row).select().single()); if(error) throw error; return {ok:true,data:flatContent(data)};
      }
      case "adminHapusKonten":
        ({error}=await db.from("member_content").delete().eq("id",payload.id)); if(error) throw error; return {ok:true};
      case "adminAnalisisWordGemini": case "adminBuatSoalGemini": case "adminRapikanSoalGemini":
        throw new Error("Fitur Gemini memerlukan Edge Function/API terpisah dan belum diaktifkan.");
      default: throw new Error("Aksi admin belum dikenali: "+action);
    }
    ({error}=await db.from("member_profiles").update(q).eq("id",payload.id)); if(error) throw error; return {ok:true};
  }
  window.KFSupabaseAdmin = { configured, ensureAdmin, api, client:db };
})();

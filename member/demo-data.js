(function(){
  "use strict";
  const KEY="kf_member_demo_database_v1", SESSION="kf_member_demo_session", ADMIN_SESSION="kf_member_demo_admin", ADMIN_FAIL="kf_member_demo_admin_fail";
  const now=()=>new Date().toISOString(), future=(d)=>new Date(Date.now()+d*86400000).toISOString();
  const id=()=>"demo-"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  function seed(){return {
    accounts:[
      {id:"demo-active",email:"peserta.demo@gmail.com",password:"PesertaDemo123!",nama:"Peserta Demo Aktif",username:"pesertademo",sekolah:"SMA Contoh Pekanbaru",kelas:"11",jenjang:"sma",paket:"Paket Intensif 30 Hari",status:"aktif",berakhir:future(30),created_at:now(),updated_at:now()},
      {id:"demo-pending",email:"pending.demo@gmail.com",password:"PendingDemo123!",nama:"Peserta Demo Menunggu",username:"pendingdemo",sekolah:"SMP Contoh Pekanbaru",kelas:"9",jenjang:"smp",paket:"",status:"pending",berakhir:null,created_at:now(),updated_at:now()}
    ],
    admin:{email:"admin.demo@gmail.com",password:"AdminDemo123!",nama:"Admin Utama Demo"},
    admins:[{user_id:"demo-admin-main",email:"admin.demo@gmail.com",password:"AdminDemo123!",display_name:"Admin Utama Demo",role:"super_admin",active:true,created_at:now()}],
    packages:[
      {nama:"Paket Reguler 30 Hari",harga:50000,durasi_hari:30,deskripsi:"Modul, latihan soal, video pembahasan, dan tryout selama 30 hari.",aktif:true},
      {nama:"Paket Intensif 30 Hari",harga:100000,durasi_hari:30,deskripsi:"Seluruh materi reguler, bank soal intensif, tryout, dan pembahasan lengkap.",aktif:true},
      {nama:"Paket Juara 90 Hari",harga:250000,durasi_hari:90,deskripsi:"Program belajar lengkap selama 90 hari untuk persiapan lomba dan OSN.",aktif:true}
    ],
    payment:{bank:"BCA",nomorRekening:"8230555525",pemilikRekening:"KOSMER ADY KRISTO NAIBAHO",whatsapp:"6281365657020"},
    content:[
      {id:"demo-modul-1",jenjang:"sma",jenis:"modul",tujuan:null,topik:"Kinematika",judul:"Modul Gerak Lurus",deskripsi:"Materi contoh gerak lurus dan grafik kinematika.",visible:true,created_at:now()},
      {id:"demo-soal-1",jenjang:"sma",jenis:"soal",tujuan:"latihan",topik:"Dinamika",judul:"Latihan Hukum Newton",soal:"Benda 2 kg mendapat gaya resultan 10 N. Berapakah percepatannya?",tipe:"pg4",opsi:["2 m/s²","5 m/s²","10 m/s²","20 m/s²"],kunci:1,pembahasan:"a = F/m = 10/2 = 5 m/s².",visible:true,created_at:now()},
      {id:"demo-video-1",jenjang:"sma",jenis:"video",tujuan:null,topik:"Energi",judul:"Video Pembahasan Energi",deskripsi:"Kartu contoh video pembahasan.",visible:true,created_at:now()},
      {id:"demo-tryout-1",jenjang:"sma",jenis:"tryout",tujuan:"tryout",topik:"OSN Fisika",judul:"Tryout Mingguan Demo",paket:"Tryout Demo",catatan:"Paket tryout contoh untuk pengujian tampilan.",visible:true,created_at:now()}
    ],orders:[],attempts:[],logs:[],versions:[]
  };}
  function load(){try{const db=JSON.parse(localStorage.getItem(KEY))||reset();db.logs=db.logs||[];db.versions=db.versions||[];db.admins=db.admins||[{user_id:"demo-admin-main",email:db.admin.email,password:db.admin.password,display_name:db.admin.nama,role:"super_admin",active:true,created_at:now()}];db.content=(db.content||[]).map(x=>({...x,publication_status:x.publication_status||(x.visible!==false?"published":"draft")}));return db;}catch(_){return reset();}}
  function save(db){localStorage.setItem(KEY,JSON.stringify(db));return db;}
  function reset(){const db=seed();save(db);localStorage.removeItem(SESSION);sessionStorage.removeItem(ADMIN_SESSION);return db;}
  function publicMember(x){const y={...x};delete y.password;return y;}
  function register(v){const db=load(),email=String(v.email||"").trim().toLowerCase(),username=String(v.username||"").trim().toLowerCase();
    if(db.accounts.some(x=>x.email===email))throw new Error("Email sudah terdaftar.");
    if(db.accounts.some(x=>x.username===username))throw new Error("Username sudah digunakan.");
    const kelas=String(v.kelas||""),member={id:id(),email,password:v.password,nama:v.nama,username,sekolah:v.sekolah,kelas,jenjang:v.jenjang||(Number(kelas)<=6?"sd":Number(kelas)<=9?"smp":"sma"),paket:"",status:"pending",berakhir:null,created_at:now(),updated_at:now()};
    db.accounts.unshift(member);save(db);localStorage.setItem(SESSION,member.id);return publicMember(member);
  }
  function login(email,password){const db=load(),m=db.accounts.find(x=>x.email===String(email||"").trim().toLowerCase()&&x.password===password);if(!m)throw new Error("Email atau password demo tidak benar.");localStorage.setItem(SESSION,m.id);return publicMember(m);}
  function current(){const db=load(),m=db.accounts.find(x=>x.id===localStorage.getItem(SESSION));return m?publicMember(m):null;}
  function updateMember(member){const db=load(),i=db.accounts.findIndex(x=>x.id===member.id);if(i>=0){db.accounts[i]={...db.accounts[i],...member,updated_at:now()};save(db);}return publicMember(db.accounts[i]);}
  async function api(action,payload={}){const db=load();
    const role=(db.admins.find(x=>x.email===sessionStorage.getItem(ADMIN_SESSION)&&x.active)||{}).role||"";
    const contentAllowed=new Set(["adminLogin","adminCurrentRole","adminListKonten","adminSimpanKonten","adminHapusKonten","adminPulihkanKonten","adminVersiKonten","adminAnalisisWordGemini","adminBuatSoalGemini","adminRapikanSoalGemini","adminAsistenSoal","adminListPaket"]);
    if(role==="content_admin"&&!contentAllowed.has(action))throw new Error("Akses ini hanya untuk Admin Utama.");
    switch(action){
      case "adminLogin": return {ok:true};
      case "adminCurrentRole": return {ok:true,data:{role:(db.admins.find(x=>x.email===sessionStorage.getItem(ADMIN_SESSION))||{}).role||"content_admin"}};
      case "adminListAdmins": return {ok:true,data:db.admins.map(({password,...x})=>x)};
      case "adminCreateContentAdmin": {if(db.admins.some(x=>x.email===String(payload.email||"").toLowerCase()))throw new Error("Email sudah menjadi admin");const row={user_id:id(),email:String(payload.email||"").trim().toLowerCase(),password:String(payload.password||""),display_name:String(payload.display_name||"").trim(),role:"content_admin",active:true,created_at:now()};db.admins.push(row);db.logs.unshift({aksi:"tambah_admin_konten",target_type:"admin",target_id:row.user_id,created_at:now()});save(db);return {ok:true,data:row};}
      case "adminSetAdminActive": {const x=db.admins.find(a=>a.user_id===payload.user_id&&a.role==="content_admin");if(!x)throw new Error("Admin Konten tidak ditemukan");x.active=payload.active===true;save(db);return {ok:true};}
      case "adminListMember": return {ok:true,data:db.accounts.map(publicMember).map(x=>({...x,email:String(x.email||"").replace(/^(.{3}).*(@.*)$/,"$1***$2"),wa:String(x.wa||"").replace(/^(\d{4}).*(\d{4})$/,"$1****$2")}))};
      case "adminListPaket": return {ok:true,data:db.packages.map(x=>({...x,durasiHari:x.durasi_hari}))};
      case "adminSimpanPaket": {const p=payload.item||{},i=db.packages.findIndex(x=>x.nama===p.nama),row={nama:p.nama,harga:Number(p.harga)||0,durasi_hari:Number(p.durasiHari)||30,deskripsi:p.deskripsi||"",aktif:p.aktif!==false};if(i<0)db.packages.push(row);else db.packages[i]={...db.packages[i],...row};save(db);return {ok:true};}
      case "adminHapusPaket": {const p=db.packages.find(x=>x.nama===payload.nama);if(p)p.aktif=false;save(db);return {ok:true};}
      case "adminAktifkanPaket": {const p=db.packages.find(x=>x.nama===payload.nama);if(p)p.aktif=true;save(db);return {ok:true};}
      case "adminGetPaymentSettings": return {ok:true,data:db.payment};
      case "adminSavePaymentSettings": db.payment={...db.payment,...payload.item};save(db);return {ok:true,data:db.payment};
      case "adminVerifikasi": {const m=db.accounts.find(x=>x.id===payload.id),p=db.packages.find(x=>x.nama===payload.paket);if(!m)throw new Error("Peserta tidak ditemukan");m.status="aktif";m.paket=payload.paket;m.berakhir=future((p&&p.durasi_hari)||30);save(db);return {ok:true};}
      case "adminTolak": case "adminNonaktifkan": case "adminAktifkanKembali": case "adminHapusMember": {const m=db.accounts.find(x=>x.id===payload.id);if(!m)throw new Error("Peserta tidak ditemukan");m.status=action==="adminTolak"?"ditolak":action==="adminNonaktifkan"?"nonaktif":action==="adminHapusMember"?"dihapus":"aktif";save(db);return {ok:true};}
      case "adminListKonten": return {ok:true,data:db.content};
      case "adminSimpanKonten": {const row={...payload.item,id:payload.item.id||id(),created_at:payload.item.created_at||now(),updated_at:now()},i=db.content.findIndex(x=>x.id===row.id);row.publication_status=row.publication_status||(row.visible===false?"draft":"published");row.visible=row.publication_status==="published";db.versions.push({content_id:row.id,version_no:db.versions.filter(v=>v.content_id===row.id).length+1,change_reason:i<0?"dibuat":"diubah",created_at:now()});if(i<0)db.content.push(row);else db.content[i]=row;db.logs.unshift({aksi:i<0?"buat_konten":"ubah_konten",target_type:"konten",target_id:row.id,created_at:now()});save(db);return {ok:true,data:row};}
      case "adminHapusKonten": {const x=db.content.find(x=>x.id===payload.id);if(x){x.visible=false;x.publication_status="archived";x.archived_at=now();x.archive_reason=payload.reason||"";db.logs.unshift({aksi:"arsip_konten",target_type:"konten",target_id:x.id,created_at:now()});}save(db);return {ok:true};}
      case "adminPulihkanKonten": {const x=db.content.find(x=>x.id===payload.id);if(x){x.visible=false;x.publication_status="draft";x.archived_at=null;db.logs.unshift({aksi:"pulihkan_konten",target_type:"konten",target_id:x.id,created_at:now()});}save(db);return {ok:true};}
      case "adminVersiKonten": return {ok:true,data:db.versions.filter(v=>v.content_id===payload.id).sort((a,b)=>b.version_no-a.version_no)};
      case "adminListOrders": return {ok:true,data:db.orders};
      case "adminReports": return {ok:true,data:{orders:db.orders,members:db.accounts.map(publicMember),attempts:db.attempts,logs:db.logs,content:db.content}};
      case "adminAnalisisWordGemini": case "adminBuatSoalGemini": case "adminRapikanSoalGemini": case "adminAsistenSoal": throw new Error("Gemini memerlukan Edge Function dan tidak tersedia dalam Mode Demo.");
      default: throw new Error("Aksi demo belum tersedia: "+action);
    }
  }
  window.KFDemo={load,save,reset,register,login,current,updateMember,api,logout(){localStorage.removeItem(SESSION);},adminLogin(email,password){const state=JSON.parse(sessionStorage.getItem(ADMIN_FAIL)||'{"count":0,"until":0}');if(state.until>Date.now())throw new Error("Terlalu banyak percobaan. Coba lagi beberapa menit.");const a=load().admins.find(x=>x.email===String(email||"").trim().toLowerCase()&&x.password===password&&x.active),ok=!!a;if(ok){sessionStorage.setItem(ADMIN_SESSION,a.email);sessionStorage.removeItem(ADMIN_FAIL);return true;}state.count++;if(state.count>=5){state.count=0;state.until=Date.now()+5*60*1000;}sessionStorage.setItem(ADMIN_FAIL,JSON.stringify(state));return false;},adminActive(){const email=sessionStorage.getItem(ADMIN_SESSION);return !!load().admins.find(x=>x.email===email&&x.active);},adminRole(){const email=sessionStorage.getItem(ADMIN_SESSION);return (load().admins.find(x=>x.email===email&&x.active)||{}).role||"";},adminLogout(){sessionStorage.removeItem(ADMIN_SESSION);},accounts:{adminEmail:"admin.demo@gmail.com",adminPassword:"AdminDemo123!",memberEmail:"peserta.demo@gmail.com",memberPassword:"PesertaDemo123!",pendingEmail:"pending.demo@gmail.com",pendingPassword:"PendingDemo123!"}};
})();

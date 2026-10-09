/* KlinikFisikapku Monitoring Peserta V2 — read-only status calculation. */
(function(root){
"use strict";
const lower=x=>String(x??"").trim().toLowerCase();
const time=x=>{const n=x?Date.parse(x):0;return Number.isFinite(n)?n:0};
const approved=new Set(["approved","active"]);
const waiting=new Set(["pending"]);
const ignored=new Set(["cancelled","canceled","archived","rejected"]);
function classify(x){
 const m=x.member||{},now=x.now||Date.now(),packages=x.catalog||[],
       catalog=new Map(packages.map(p=>[String(p.id),p])),
       ownerships=Array.isArray(x.ownerships)?x.ownerships:[],
       orders=Array.isArray(x.orders)?x.orders:[],
       active=ownerships.filter(o=>lower(o.status)==="active"&&(!time(o.expires_at)||time(o.expires_at)>now)),
       inactive=ownerships.filter(o=>lower(o.status)==="expired"||(lower(o.status)==="active"&&time(o.expires_at)>0&&time(o.expires_at)<=now)),
       ids=new Set(active.map(o=>String(o.package_id))),
       pending=orders.filter(o=>waiting.has(lower(o.status))),
       accepted=orders.filter(o=>approved.has(lower(o.status))),
       unknown=orders.filter(o=>!approved.has(lower(o.status))&&!waiting.has(lower(o.status))&&!ignored.has(lower(o.status))),
       findings=[],missing=[],uncertain=[],state=lower(m.status);
 let access="normal",accessLabel="Akses Normal",material="none",materialLabel="—";
 if(x.ownershipError){
   access="review";accessLabel="Audit Akses Gagal";findings.push("Hak akses paket tidak dapat dibaca dari Supabase.");
 }else{
   active.forEach(o=>{const pkg=catalog.get(String(o.package_id));if(!pkg)missing.push("Paket aktif tidak ditemukan di katalog: "+String(o.package_name||"Paket"));else if(lower(pkg.jenjang)!==lower(m.jenjang))missing.push("Jenjang tidak cocok dengan "+pkg.nama)});
   accepted.forEach(order=>{
     const items=x.orderItems?.[String(order.id)];
     if(!Array.isArray(items)||!items.length){uncertain.push("Rincian transaksi disetujui belum dapat dibaca");return;}
     items.forEach(item=>{
       let id=item.package_id||item.member_package_id;
       if(!id){
         const same=packages.filter(p=>lower(p.nama)===lower(item.package_name));
         if(same.length===1)id=same[0].id;
       }
       if(!id){uncertain.push("Paket pada transaksi belum dapat dikenali");return;}
       id=String(id);if(ids.has(id))return;
       const pkg=catalog.get(id),old=inactive.find(o=>String(o.package_id)===id);
       const created=time(order.created_at),approval=time(order.approved_at)||created;
       if(old&&(!time(old.expires_at)||!approval||approval<=time(old.expires_at)))return;
       const duration=Number(pkg?.durasi_hari)||0;
       if(duration>0&&approval>0&&approval+duration*86400000>now){
         missing.push("Transaksi disetujui tetapi akses "+String(pkg?.nama||item.package_name||"paket")+" belum aktif");
       }else uncertain.push("Masa berlaku transaksi "+String(pkg?.nama||item.package_name||"paket")+" perlu diverifikasi");
     });
   });
   if(missing.length){access="bad";accessLabel="Akses Bermasalah";findings.push(...missing);}
   else if(x.ordersError||uncertain.length||unknown.length){
     access="review";accessLabel="Perlu Verifikasi";
     if(x.ordersError)findings.push("Riwayat pembelian tidak dapat dibaca.");
     findings.push(...uncertain.slice(0,4));
     if(unknown.length)findings.push("Ada status transaksi yang harus diperiksa Admin.");
   }else if(active.length){
     if(["pending","nonaktif","ditolak","dihapus","expired"].includes(state)||
        (state==="aktif"&&time(m.berakhir)>0&&time(m.berakhir)<=now)){
       access="review";accessLabel="Status Akun Perlu Diperiksa";
       findings.push("Hak paket aktif tetapi status akun berpotensi membatasi akses.");
     }else if(pending.length)findings.push("Ada permintaan paket tambahan menunggu verifikasi.");
   }else if(pending.length){access="pending";accessLabel="Menunggu Verifikasi";findings.push("Permintaan paket masih pending, belum disetujui Admin.");}
   else if(inactive.length||state==="expired"||(state==="aktif"&&time(m.berakhir)>0&&time(m.berakhir)<=now)){
     access="expired";accessLabel="Paket Berakhir";findings.push("Masa berlaku akses telah berakhir.");
   }else if(["nonaktif","ditolak","dihapus"].includes(state)){
     access="none";accessLabel=state==="nonaktif"?"Akun Nonaktif":state==="ditolak"?"Akun Ditolak":"Akun Diarsipkan";
   }else{access="none";accessLabel="Belum Berlangganan";findings.push("Tidak ada paket aktif atau permintaan pembelian yang disetujui.");}
 }
 if(x.ownershipError){material="unknown";materialLabel="Belum Diperiksa";}
 else if(active.length&&x.materialsError){material="unknown";materialLabel="Belum Diperiksa";findings.push("Pemeriksaan materi gagal; jangan menafsirkan sebagai konten kosong.");}
 else if(active.length){
   const empty=active.filter(p=>!Number(x.materialCounts?.get(String(p.package_id))||0));
   if(empty.length){material="missing";materialLabel="Konten Belum Lengkap";empty.forEach(p=>findings.push(String(p.package_name||catalog.get(String(p.package_id))?.nama||"Paket")+" belum memiliki Modul/PDF/Video yang tampil"));}
   else {material="available";materialLabel="Materi Tersedia";}
 }
 const status=access==="normal"&&["missing","unknown"].includes(material)?"warn":access;
 const action=status==="bad"?"check":status==="pending"?"orders":material==="missing"?"content":status==="review"?"retry":"none";
 return {member:m,active,status,access,accessLabel,material,materialLabel,findings,action};
}
root.KFMonitoringV2=Object.freeze({classify});
if(typeof module!=="undefined"&&module.exports)module.exports=root.KFMonitoringV2;
})(typeof window!=="undefined"?window:{});

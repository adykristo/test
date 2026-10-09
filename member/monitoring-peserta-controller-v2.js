/* KlinikFisikapku — Monitoring Peserta V2 controller, READ ONLY.
   Dipasang setelah seluruh kode Admin agar fungsi lama tetap tersedia. */
(function(){
"use strict";
if(!window.KFMonitoringV2){console.error("[KF Monitoring] Classifier tidak ditemukan.");return;}
let busy=false;
async function bounded(items,concurrency,work){
 const result=new Array(items.length);let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
   while(next<items.length){
     const i=next++;
     try{result[i]=await work(items[i],i);}catch(e){result[i]={error:String(e?.message||e)};}
   }
 }));
 return result;
}
function unwrap(x){return x.status==="fulfilled"?x.value:{data:null,error:{message:x.reason?.message||"Permintaan gagal"}};}
function esc(s){return escMember(String(s==null?"":s));}
function countMaterials(links,content){
 const allowed=new Set((content||[]).filter(x=>{
   if(x.visible===false)return false;
   const kind=String(x.jenis||"").toLowerCase(),source=String(x.data?.source_type||"").toLowerCase();
   return ["pdf","modul","module","materi","video","youtube","yt"].includes(kind)||
     (kind==="soal"&&source!=="interactive"&&String(x.tujuan||"").toLowerCase()!=="tryout");
 }).map(x=>String(x.id)));
 const counts=new Map();
 for(const row of links||[]){
   if(!allowed.has(String(row.content_id)))continue;
   const key=String(row.package_id);
   counts.set(key,(counts.get(key)||0)+1);
 }
 return counts;
}
function renderAudit(){
 const search=String(document.getElementById("kfAuditCari")?.value||"").toLowerCase(),
       jenjang=String(document.getElementById("kfAuditJenjang")?.value||"").toUpperCase();
 const filtered=KF_AUDIT_ROWS.filter(r=>(!jenjang||String(r.member?.jenjang||"").toUpperCase()===jenjang)&&
   (!search||[r.member?.nama,r.member?.email,r.member?.paket,...(r.active||[]).map(p=>p.package_name)].join(" ").toLowerCase().includes(search)));
 const count=s=>KF_AUDIT_ROWS.filter(r=>r.status===s).length;
 const set=(id,v)=>{const node=document.getElementById(id);if(node)node.textContent=v;};
 set("kfAuditTotal",KF_AUDIT_ROWS.length);set("kfAuditNormal",count("normal"));
 set("kfAuditNeutral",count("none")+count("pending")+count("expired"));
 set("kfAuditWarn",count("warn")+count("review"));set("kfAuditBad",count("bad"));
 const accessIcon={normal:"🟢",bad:"🔴",review:"🟡",pending:"🕒",expired:"⚪",none:"⚪"},
       materialIcon={available:"🟢",missing:"🟡",unknown:"⚪",none:""};
 const body=document.getElementById("kfAuditRows");if(!body)return;
 body.innerHTML=filtered.map(r=>{
   const m=r.member||{},id=esc(m.id),level=esc(String(m.jenjang||"").toUpperCase()),actions=[];
   actions.push('<button class="btn ghost small" onclick="kfLihatSebagaiPeserta(\''+id+'\')">👁 Lihat Tampilan</button>');
   if(r.action==="orders"||r.status==="expired"){
     actions.push('<button class="btn small" onclick="openPanel(\'transaksi\');renderBundleOrders()">📋 Periksa Permintaan</button>');
   }
   if(r.action==="check")actions.push('<button class="btn small" onclick="kfPerbaikiPaketPeserta(\''+id+'\')">✎ Periksa Akses</button>');
   if(r.material==="missing")actions.push('<button class="btn small" onclick="kfAuditKelolaMateri(\''+level+'\')">📘 Kelola Materi</button>');
   if(r.status==="review")actions.push('<button class="btn ghost small" onclick="kfAuditPeserta()">↻ Audit Ulang</button>');
   return '<tr><td><b>'+esc(m.nama||"Member")+'</b><br><small>'+esc(m.email||"")+'</small></td><td>'+level+'</td>'+
     '<td>'+esc((r.active||[]).map(x=>x.package_name).join(", ")||"—")+'</td>'+
     '<td><b>'+(accessIcon[r.access]||"⚪")+' '+esc(r.accessLabel)+'</b></td>'+
     '<td><b>'+(materialIcon[r.material]||"")+' '+esc(r.materialLabel)+'</b></td>'+
     '<td><small>'+esc(r.findings.join(" • ")||"Tidak ada anomali yang terdeteksi")+'</small></td>'+
     '<td><div class="row-actions">'+actions.join("")+'</div></td></tr>';
 }).join("")||'<tr><td colspan="7" style="text-align:center;padding:24px">Tidak ada peserta sesuai filter.</td></tr>';
 const el=document.getElementById("kfAuditSummary");
 if(el)el.textContent=filtered.length+" peserta ditampilkan · Audit baca-saja, tidak mengubah akses atau riwayat peserta.";
}
async function runAudit(){
 if(busy)return;busy=true;
 const box=document.getElementById("kfAuditSummary");if(box)box.textContent="Memeriksa kepemilikan paket, transaksi dan materi…";
 try{
   if(!MEMBER_CACHE.length){
     const q=await adminApi("adminListMember",{});
     MEMBER_CACHE=q.data||[];
   }
   await loadPackageCore();
   const db=kfdb(),members=MEMBER_CACHE.slice(),
         ids=new Set(members.map(m=>String(m.id)));
   const results=await Promise.allSettled([
     db.from("member_content_packages").select("content_id,package_id"),
     db.from("member_content").select("id,jenis,tujuan,visible,data"),
     db.rpc("kf_admin_bundle_orders")
   ]);
   const links=unwrap(results[0]),contents=unwrap(results[1]),ordersResult=unwrap(results[2]);
   const materialError=links.error||contents.error||
     ((links.data||[]).length>=1000||((contents.data||[]).length>=1000)?{message:"Data materi mencapai batas hasil Supabase"}:null);
   const materialCounts=materialError?new Map():countMaterials(links.data,contents.data);
   const orders=Array.isArray(ordersResult.data)?ordersResult.data:[];
   const orderError=ordersResult.error||(!Array.isArray(ordersResult.data)?{message:"Respons transaksi tidak valid"}:orders.length>=1000?{message:"Data transaksi mencapai batas hasil Supabase"}:null);
   const byUser=new Map();
   for(const o of orders){
     const uid=String(o.user_id||o.member_id||"");
     if(!ids.has(uid))continue;
     if(!byUser.has(uid))byUser.set(uid,[]);
     byUser.get(uid).push(o);
   }
   const accepted=orders.filter(o=>ids.has(String(o.user_id||o.member_id||""))&&["approved","active"].includes(String(o.status||"").toLowerCase()));
   const itemLists=await bounded(accepted,4,async o=>{
     const r=await db.rpc("kf_admin_bundle_order_items",{p_order:o.id});
     if(r.error)throw r.error;
     return Array.isArray(r.data)?r.data:null;
   });
   const orderItems={};
   accepted.forEach((o,i)=>{orderItems[String(o.id)]=Array.isArray(itemLists[i])?itemLists[i]:null;});
   let done=0;
   const rows=await bounded(members,4,async m=>{
     const own=await db.rpc("kf_admin_member_packages",{p_user:m.id});
     done++;
     if(box&&done%5===0)box.textContent="Memeriksa "+done+"/"+members.length+" peserta…";
     return KFMonitoringV2.classify({
       member:m,ownerships:own.error?[]:(own.data||[]),
       ownershipError:own.error?.message||null,
       orders:byUser.get(String(m.id))||[],ordersError:orderError?.message||null,
       orderItems,catalog:KF_PACKAGES_NEW,materialCounts,
       materialsError:materialError?.message||null
     });
   });
   KF_AUDIT_ROWS=rows.map((r,i)=>r?.error?KFMonitoringV2.classify({
     member:members[i],ownershipError:String(r.error)
   }):r);
   renderAudit();
 }catch(e){
   KF_AUDIT_ROWS=[];renderAudit();
   if(box)box.textContent="Audit belum dapat diselesaikan: "+String(e?.message||e)+". Tidak ada data peserta yang diubah.";
   console.warn("[KF Monitoring V2]",e);
 }finally{busy=false;}
}
function manageMaterial(level){
 openKontenV2("pdf");
 KFUI.toast("Pilih jenjang "+level+" dan paket yang memerlukan modul, PDF atau video. Pemetaan paket peserta tidak perlu diubah.","info",6500);
}
async function checkAccess(id){
 const r=KF_AUDIT_ROWS.find(x=>String(x.member?.id)===String(id));
 if(!r||r.status!=="bad"){
   KFUI.toast("Tombol koreksi hanya tersedia jika masalah akses telah terverifikasi.","info",5000);return;
 }
 await kelolaPaketMember(id);
 await runAudit();
}
window.kfAuditPeserta=runAudit;window.kfRenderAuditRows=renderAudit;
window.kfAuditKelolaMateri=manageMaterial;
window.kfPerbaikiPaketPeserta=checkAccess;
})();

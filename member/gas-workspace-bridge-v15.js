
// gas-workspace-bridge-v15.js
(function(){
 const KEY="kf_package_bank_v1";
 function frame(){return document.getElementById("v12Frame")?.contentWindow}
 function gasUrl(){
   try{
     const w=frame();
     return (w&&w.KF_SUPABASE_CONFIG&&w.KF_SUPABASE_CONFIG.gasUrl)||localStorage.getItem("kf_v12_gas_url")||"";
   }catch{return localStorage.getItem("kf_v12_gas_url")||""}
 }
 async function post(action,payload){
   const u=gasUrl();if(!u)throw Error("URL Google Apps Script belum disetel.");
   let accessToken="";
   try{const c=(window.KFSupabaseAdmin&&window.KFSupabaseAdmin.client)||(window.KFMemberAuth&&window.KFMemberAuth.client);if(c){const s=await c.auth.getSession();accessToken=s.data?.session?.access_token||""}}catch{}
   if(!accessToken)throw Error("Sesi Super Admin tidak tersedia. Login ulang melalui Admin Member.");
   const r=await fetch(u,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,accessToken,...payload})});
   const d=await r.json();if(d.ok===false)throw Error(d.error||"Google Apps Script error");return d;
 }
 async function push(){
   const w=frame();if(!w)throw Error("V12 belum dimuat.");
   const packages=JSON.parse(w.localStorage.getItem(KEY)||"[]");
   return await post("saveWorkspacePackages",{packages});
 }
 async function pull(){
   const d=await post("getWorkspacePackages",{});
   const w=frame();if(!w)throw Error("V12 belum dimuat.");
   w.localStorage.setItem(KEY,JSON.stringify(d.packages||[]));
   if(typeof w.renderPackageBank==="function")w.renderPackageBank();
   return d.packages||[];
 }
 window.KFGASWorkspace={push,pull,setUrl:u=>localStorage.setItem("kf_v12_gas_url",u)};
})();

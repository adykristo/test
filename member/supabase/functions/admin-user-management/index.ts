import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function cors(req:Request){const origin=req.headers.get("origin")||"",allowed=(Deno.env.get("ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean);if(allowed.length&&origin&&!allowed.includes(origin))throw new Error("Origin tidak diizinkan");return {"Access-Control-Allow-Origin":origin||allowed[0]||"null","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};}
const reply=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}});

Deno.serve(async(req)=>{try{
  const headers=cors(req);if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return reply(req,{ok:false,error:"Metode tidak diizinkan"},405);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}}),admin=createClient(url,service);
  const {data:{user},error:userError}=await auth.auth.getUser();if(userError||!user)throw new Error("Sesi admin tidak valid");
  const {data:owner}=await admin.from("member_admins").select("role,active").eq("user_id",user.id).maybeSingle();if(!owner||!owner.active||owner.role!=="super_admin")throw new Error("Hanya Admin Utama yang dapat mengelola admin");
  const body=await req.json(),action=String(body.action||"");
  if(action==="list"){
    const {data:rows,error}=await admin.from("member_admins").select("user_id,role,display_name,active,created_at").order("created_at");if(error)throw error;
    const users=[];for(const row of rows||[]){const {data:u}=await admin.auth.admin.getUserById(row.user_id);users.push({...row,email:u?.user?.email||""});}
    return reply(req,{ok:true,data:users});
  }
  if(action==="create"){
    const email=String(body.email||"").trim().toLowerCase(),name=String(body.display_name||"").trim(),password=String(body.password||"");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Email admin tidak valid");if(name.length<2||name.length>100)throw new Error("Nama admin harus 2–100 karakter");if(password.length<10)throw new Error("Password sementara minimal 10 karakter");
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nama:name,admin_role:"content_admin"}});if(created.error)throw created.error;
    const id=created.data.user.id,{error}=await admin.from("member_admins").insert({user_id:id,role:"content_admin",display_name:name,active:true});
    if(error){await admin.auth.admin.deleteUser(id);throw error;}
    await admin.from("member_profiles").delete().eq("id",id);
    await admin.from("member_admin_logs").insert({admin_id:user.id,aksi:"tambah_admin_konten",target_type:"admin",target_id:id,detail:{email,display_name:name}});
    return reply(req,{ok:true,data:{user_id:id,email,display_name:name,role:"content_admin",active:true}});
  }
  if(action==="set_active"){
    const id=String(body.user_id||""),active=body.active===true;if(id===user.id)throw new Error("Admin Utama tidak dapat menonaktifkan dirinya sendiri");
    const {data:target,error:findError}=await admin.from("member_admins").select("role").eq("user_id",id).single();if(findError)throw findError;if(target.role!=="content_admin")throw new Error("Hanya Admin Konten yang dapat diubah");
    const {error}=await admin.from("member_admins").update({active}).eq("user_id",id);if(error)throw error;
    await admin.from("member_admin_logs").insert({admin_id:user.id,aksi:active?"aktifkan_admin_konten":"nonaktifkan_admin_konten",target_type:"admin",target_id:id,detail:{}});
    return reply(req,{ok:true});
  }
  throw new Error("Aksi tidak dikenali");
}catch(error:any){console.error("admin-user-management",error);try{return reply(req,{ok:false,error:String(error?.message||error)},400);}catch{return new Response('{"ok":false,"error":"Permintaan ditolak"}',{status:403,headers:{"Content-Type":"application/json"}});}}});

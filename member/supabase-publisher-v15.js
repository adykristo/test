
// supabase-publisher-v15.js — dipakai Admin setelah login Supabase.
// Paket final disimpan ke kf_packages + kf_questions.
(function(){
  function c(){
    if(window.KFSupabaseAdmin&&window.KFSupabaseAdmin.client)return window.KFSupabaseAdmin.client;
    if(window.KFMemberAuth&&window.KFMemberAuth.client)return window.KFMemberAuth.client;
    throw new Error("Supabase Admin client belum siap.");
  }
  function key(q){
    const a=q.answers||{};
    if(q.type==="pg4"||q.type==="pg5")return Number((a.keys||[])[0]??0);
    if(q.type==="mcma")return (a.keys||[]).map(Number).sort((x,y)=>x-y);
    if(q.type==="kategori")return (a.statements||[]).map(x=>x.answer||"");
    if(q.type==="isian")return a.short||"";
    return a.essayKey||"";
  }
  async function publish(p){
    const db=c(), external=String(p.id), meta={
      external_id:external,kind:p.kind,name:p.name,jenjang:p.questions?.[0]?.jenjang||null,
      kelas:p.questions?.[0]?.kelas||null,mapel:p.questions?.[0]?.mapel||"Fisika",
      subscription:p.subscription||"Semua Paket Aktif",duration_minutes:Number(p.duration)||0,
      starts_at:p.start||null,ends_at:p.end||null,max_attempts:Number(p.attempts)||1,
      visible:true,source:"V12",source_version:Number(p.sourceVersion)||1,ai_provider:p.aiProvider||p.questions?.find(q=>q.aiProvider)?.aiProvider||null,review_status:"reviewed",published_at:new Date().toISOString(),updated_at:new Date().toISOString()
    };
    let {data:pack,error}=await db.from("kf_packages").upsert(meta,{onConflict:"external_id"}).select().single();
    if(error)throw error;
    const {error:delErr}=await db.from("kf_questions").delete().eq("package_id",pack.id);if(delErr)throw delErr;
    const rows=(p.questions||[]).map((q,i)=>({
      package_id:pack.id,external_id:String(q.id||i+1),position:i+1,type:q.type||"pg4",topic:q.topik||"",
      question:q.question||"",image:q.image||null,options:q.answers?.options||[],answer_key:key(q),
      statements:(q.answers?.statements||[]).map(x=>({text:x.text||"",key:x.answer||""})),
      category_labels:q.type==="kategori"?["Benar","Salah"]:[],explanation:q.explanation||"",
      scoring:q.scoring||"exact",source_v12_package:q.sourceV12Package||p.id||null,
      source_v12_question:q.sourceV12Question||q.id||null,ai_provider:q.aiProvider||null,review_status:q.reviewStatus||"reviewed",reviewed_at:q.reviewedAt||null,published_at:new Date().toISOString(),updated_at:new Date().toISOString()
    }));
    if(rows.length){const {error:e}=await db.from("kf_questions").insert(rows);if(e)throw e;}
    return pack;
  }
  async function unpublish(externalId){const {error}=await c().from("kf_packages").update({visible:false,updated_at:new Date().toISOString()}).eq("external_id",String(externalId));if(error)throw error;}
  async function adminList(){const {data,error}=await c().from("kf_packages").select("*,kf_questions(count)").order("updated_at",{ascending:false});if(error)throw error;return data||[];}
  window.KFPackagePublisher={publish,unpublish,adminList};
})();

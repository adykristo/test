
// supabase-data-v15.js — KlinikFisikapku V15
(function(){
  function client(){
    if(window.KFMemberAuth&&window.KFMemberAuth.client)return window.KFMemberAuth.client;
    if(window.KFSupabaseAdmin&&window.KFSupabaseAdmin.client)return window.KFSupabaseAdmin.client;
    throw new Error("Supabase client belum siap.");
  }
  async function rpc(name,args){const {data,error}=await client().rpc(name,args||{});if(error)throw error;return data;}
  async function listPackages(){return await rpc("kf_list_available_packages");}
  async function memberCatalog(){return await rpc("kf_member_package_catalog");}
  async function memberTopics(){return await rpc("kf_member_topics");}
  async function paymentMethods(){return await rpc("kf_payment_methods");}
  async function createPackageOrder(packageId,paymentMethodId){return await rpc("kf_create_package_order",{p_package:packageId,p_payment_method:paymentMethodId||null});}
  async function startAttempt(packageId){return await rpc("kf_start_attempt",{p_package:packageId});}
  async function questions(attemptId){
    const rows=await rpc("kf_attempt_questions",{p_attempt:attemptId});
    return (rows||[]).map(q=>({...q,id:q.question_id,position:q.question_position,type:q.question_type}));
  }
  async function saveAnswer(attemptId,questionId,answer){return await rpc("kf_save_answer",{p_attempt:attemptId,p_question:questionId,p_answer:answer});}
  async function uploadEssayFile(attemptId,questionId,file){
    if(!file)throw new Error("Pilih file jawaban terlebih dahulu.");
    const allowed=["application/pdf","image/jpeg","image/png","image/webp"];
    if(!allowed.includes(String(file.type||"").toLowerCase()))throw new Error("File harus PDF, JPG, PNG, atau WEBP.");
    if(Number(file.size||0)>10*1024*1024)throw new Error("Ukuran file maksimal 10 MB.");
    const db=client();
    const {data:sessionData,error:sessionError}=await db.auth.getSession();
    if(sessionError)throw sessionError;
    const uid=sessionData?.session?.user?.id;
    if(!uid)throw new Error("Peserta belum login.");
    const ext={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[String(file.type||"").toLowerCase()];
    const path=uid+"/"+String(attemptId)+"/"+String(questionId)+"/"+Date.now()+"."+ext;
    const {error}=await db.storage.from("essay-submissions").upload(path,file,{
      cacheControl:"3600",upsert:false,contentType:file.type
    });
    if(error)throw error;
    return path;
  }
  async function saveEssaySubmission(attemptId,questionId,answerText,answerFileUrl){
    // SECURITY: package_id/participant_id tidak lagi dipercaya dari browser.
    // Server memvalidasi auth.uid(), pemilik attempt, deadline, paket, dan tipe soal.
    return await rpc("kf_save_essay_submission",{
      p_attempt:attemptId,
      p_question:questionId,
      p_answer_text:String(answerText||""),
      p_answer_file_url:String(answerFileUrl||"")
    });
  }
  async function submit(attemptId,auto){
    // SECURITY: satu-satunya submit engine peserta adalah V13.
    // Tidak ada fallback ke engine lama agar scoring/deadline selalu konsisten.
    return await rpc("kf_submit_attempt_v13",{p_attempt:attemptId,p_auto:!!auto});
  }
  async function reviewAttempt(attemptId){
    // SECURITY: kunci/pembahasan tidak pernah diambil dengan SELECT langsung dari browser.
    // Server RPC memverifikasi auth.uid(), kepemilikan attempt, status submitted,
    // serta menahan review Tryout sampai ends_at terlewati.
    return await rpc("kf_review_attempt",{p_attempt:attemptId});
  }
  async function results(){return await rpc("kf_my_results");}
  window.KFPackageDB={client,rpc,listPackages,memberCatalog,memberTopics,paymentMethods,createPackageOrder,startAttempt,questions,saveAnswer,uploadEssayFile,saveEssaySubmission,submit,reviewAttempt,results};
})();

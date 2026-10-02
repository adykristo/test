
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
  async function submit(attemptId,auto){return await rpc("kf_submit_attempt",{p_attempt:attemptId,p_auto:!!auto});}
  async function results(){return await rpc("kf_my_results");}
  window.KFPackageDB={client,rpc,listPackages,memberCatalog,memberTopics,paymentMethods,createPackageOrder,startAttempt,questions,saveAnswer,submit,results};
})();

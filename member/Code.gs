/** KlinikFisikapku - Google Apps Script Question Engine
 * Script Properties wajib:
 * SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * Opsional: GEMINI_MODEL (default gemini-2.5-flash)
 */
function doGet(){ return json_({ok:true, service:'KlinikFisikapku Question Engine', version:'FINAL-INTEGRATED-1'}); }
function doPost(e){
  try{
    var body=JSON.parse((e.postData&&e.postData.contents)||'{}');
    var admin=verifyAdmin_(String(body.accessToken||''));
    if(!admin.ok) throw new Error(admin.error||'Akses admin ditolak.');
    var action=String(body.action||'');
    if(action==='health') return json_({ok:true});
    if(action==='generate') return createQuestions_(body, admin.user.id);
    if(action==='processText') return processText_(body, admin.user.id);
    if(action==='assistant') return assistant_(body);
    throw new Error('Aksi tidak dikenali.');
  }catch(err){ return json_({ok:false,error:String(err&&err.message||err)}); }
}
function props_(){var p=PropertiesService.getScriptProperties();return {url:p.getProperty('SUPABASE_URL'),anon:p.getProperty('SUPABASE_ANON_KEY'),service:p.getProperty('SUPABASE_SERVICE_ROLE_KEY'),gemini:p.getProperty('GEMINI_API_KEY'),model:p.getProperty('GEMINI_MODEL')||'gemini-2.5-flash'};}
function verifyAdmin_(jwt){
  if(!jwt) return {ok:false,error:'Sesi Supabase tidak ditemukan.'}; var p=props_();
  var u=UrlFetchApp.fetch(p.url+'/auth/v1/user',{headers:{apikey:p.anon,Authorization:'Bearer '+jwt},muteHttpExceptions:true});
  if(u.getResponseCode()!==200)return {ok:false,error:'Sesi Supabase tidak valid.'}; var user=JSON.parse(u.getContentText());
  var a=UrlFetchApp.fetch(p.url+'/rest/v1/member_admins?user_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=user_id,role',{headers:{apikey:p.service,Authorization:'Bearer '+p.service},muteHttpExceptions:true});
  var rows=JSON.parse(a.getContentText()||'[]'); if(!rows.length)return {ok:false,error:'Akun bukan Admin aktif.'}; return {ok:true,user:user,role:rows[0].role};
}
function createQuestions_(b,userId){
  var n=Math.max(1,Math.min(50,Number(b.jumlah)||1));
  var prompt='Buat '+n+' soal Olimpiade '+String(b.jenjang||'SMA').toUpperCase()+' topik '+String(b.topik||'Umum')+'. Tipe '+String(b.tipe||'pg5')+', kesulitan '+String(b.sulit||'Sedang')+'. '+String(b.instruksi||'')+'\n'+schemaPrompt_();
  return generateAndStore_(prompt,b,userId,'google-script-gemini');
}
function processText_(b,userId){
  var prompt='Ubah bahan berikut menjadi soal Olimpiade yang rapi. Pertahankan rumus, fakta, dan makna. Jenjang '+String(b.jenjang||'SMA').toUpperCase()+', topik '+String(b.topik||'Umum')+'.\nBAHAN:\n'+String(b.text||'').slice(0,70000)+'\n'+schemaPrompt_();
  return generateAndStore_(prompt,b,userId,'google-script-import');
}
function assistant_(b){var out=gemini_('Bertindak sebagai reviewer soal Olimpiade. '+String(b.jenis||'audit')+' terhadap teks berikut. Beri analisis ringkas dan koreksi yang konkret:\n'+String(b.text||''));return json_({ok:true,text:out});}
function schemaPrompt_(){return 'Kembalikan HANYA JSON array. Tiap item: {"tipe":"pg4|pg5|mcma|kategori|isian|esai","soal":"...","opsi":["..."],"kunci":"A atau A,C atau teks","pembahasan":"langkah lengkap","subtopik":"...","difficulty":"Mudah|Sedang|Sulit"}. Pembahasan wajib ada. Jangan gunakan markdown fence.';}
function generateAndStore_(prompt,b,userId,source){var raw=gemini_(prompt),arr=parseJson_(raw);if(!Array.isArray(arr))throw new Error('AI tidak menghasilkan daftar soal valid.');arr=arr.slice(0,50);var rows=arr.map(function(x,i){var ans=x.kunci;if(Array.isArray(ans)){}else if(typeof ans==='string'&&ans.indexOf(',')>=0)ans=ans.split(',').map(function(v){return v.trim();});else ans=[ans];return {code:'GS-'+new Date().getTime().toString(36).toUpperCase()+'-'+(i+1),jenjang:String(b.jenjang||'sma').toLowerCase(),bidang:'Fisika',topik:String(b.topik||'Umum'),subtopik:String(x.subtopik||''),difficulty:String(x.difficulty||b.sulit||'Sedang'),question_type:String(x.tipe||b.tipe||'pg5').toLowerCase(),stem:String(x.soal||''),options:Array.isArray(x.opsi)?x.opsi:[],answer:ans,explanation:String(x.pembahasan||''),image_url:(Array.isArray(b.images)&&b.images[i])?String(b.images[i]):'',source:source,status:'draft',created_by:userId,updated_by:userId};}).filter(function(x){return x.stem;});
  var saved=supabaseInsert_('member_question_bank',rows);return json_({ok:true,data:saved,questions:arr,message:rows.length+' soal tersimpan sebagai Draft di Supabase.'});}
function gemini_(prompt){var p=props_();if(!p.gemini)throw new Error('GEMINI_API_KEY belum diatur di Script Properties.');var u='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(p.model)+':generateContent?key='+encodeURIComponent(p.gemini);var r=UrlFetchApp.fetch(u,{method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.35,responseMimeType:'application/json'}}),muteHttpExceptions:true});if(r.getResponseCode()<200||r.getResponseCode()>299)throw new Error('Gemini: '+r.getContentText().slice(0,500));var j=JSON.parse(r.getContentText());return (((j.candidates||[])[0]||{}).content||{}).parts[0].text;}
function parseJson_(s){s=String(s||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();return JSON.parse(s);}
function supabaseInsert_(table,rows){if(!rows.length)return [];var p=props_();var r=UrlFetchApp.fetch(p.url+'/rest/v1/'+table,{method:'post',contentType:'application/json',headers:{apikey:p.service,Authorization:'Bearer '+p.service,Prefer:'return=representation'},payload:JSON.stringify(rows),muteHttpExceptions:true});if(r.getResponseCode()<200||r.getResponseCode()>299)throw new Error('Supabase: '+r.getContentText().slice(0,800));return JSON.parse(r.getContentText()||'[]');}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}

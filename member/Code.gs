/**
 * KlinikFisikapku — Code.gs Failover Aman
 * Backend Google Apps Script untuk V13 Question Studio.
 *
 * SCRIPT PROPERTIES (jangan taruh key di HTML/GitHub):
 * GEMINI_API_KEY       = key utama
 * GEMINI_API_KEY_2     = key/project cadangan opsional
 * GEMINI_API_KEY_3     = key/project cadangan opsional
 * GEMINI_MODEL         = model utama, contoh gemini-2.5-flash
 * GEMINI_MODELS        = opsional CSV, contoh gemini-2.5-flash,gemini-2.5-flash-lite
 * ADMIN_KEY            = secret admin lama (opsional bila memakai Supabase auth)
 *
 * Catatan:
 * - Failover model/key untuk keandalan, bukan untuk menghindari kebijakan/limit provider.
 * - 429/404/5xx boleh pindah target; 400/401/403 berhenti agar salah konfigurasi tidak disamarkan.
 * - API key tidak pernah dikirim kembali ke browser.
 */

var KF_VERSION = 'V13-FAILOVER-1';

function doGet() {
  return kfJson_({ok:true,status:'ok',service:'KlinikFisikapku Question Engine',version:KF_VERSION});
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    kfRequireAdmin_(body);
    var action = String(body.action || '').trim();

    if (action === 'health') return kfJson_({
      ok:true,status:'ok',service:'KlinikFisikapku Question Engine',
      version:KF_VERSION,models:kfModels_(),keysConfigured:kfKeys_().length
    });

    if (action === 'analisisWordTryout') return kfJson_(kfAnalisisWordTryout_(body));
    if (action === 'buatSoalGemini' || action === 'generateAI' || action === 'generate')
      return kfJson_(kfGenerateQuestions_(body));
    if (action === 'assistant' || action === 'testAI')
      return kfJson_(kfAssistant_(body));

    throw new Error('Aksi tidak dikenali: '+action);
  } catch (err) {
    return kfJson_({ok:false,status:'error',error:kfSafeError_(err)});
  }
}

function kfRequireAdmin_(body) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '');
  if (!expected) return; // bila project Anda sudah punya verifikasi Supabase, ganti fungsi ini dengan verifier tersebut.
  var supplied = String(body.key || '');
  if (!supplied || !kfConstantTimeEqual_(supplied, expected)) throw new Error('Akses admin ditolak.');
}
function kfConstantTimeEqual_(a,b){
  a=String(a);b=String(b);var d=a.length^b.length,n=Math.max(a.length,b.length);
  for(var i=0;i<n;i++)d^=(a.charCodeAt(i%Math.max(1,a.length))||0)^(b.charCodeAt(i%Math.max(1,b.length))||0);
  return d===0;
}
function kfJson_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function kfSafeError_(e){
  var s=String(e && e.message || e || 'Kesalahan server');
  // jangan pernah memantulkan key/token ke browser
  s=s.replace(/key=[^&\s]+/gi,'key=[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [REDACTED]');
  return s.slice(0,1200);
}

function kfKeys_(){
  var p=PropertiesService.getScriptProperties(),out=[];
  ['GEMINI_API_KEY','GEMINI_API_KEY_2','GEMINI_API_KEY_3'].forEach(function(n){
    var v=String(p.getProperty(n)||'').trim();if(v&&out.indexOf(v)<0)out.push(v);
  });
  return out;
}
function kfModels_(){
  var p=PropertiesService.getScriptProperties();
  var primary=String(p.getProperty('GEMINI_MODEL')||'gemini-2.5-flash').trim();
  var extra=String(p.getProperty('GEMINI_MODELS')||'gemini-2.5-flash,gemini-2.5-flash-lite').split(',');
  var out=[primary].concat(extra).map(function(x){return String(x||'').trim()}).filter(Boolean);
  return out.filter(function(v,i,a){return a.indexOf(v)===i});
}
function kfTargets_(){
  var keys=kfKeys_(),models=kfModels_(),out=[];
  // Utamakan pergantian model pada key/project utama, baru key/project cadangan.
  keys.forEach(function(key,ki){models.forEach(function(model,mi){out.push({key:key,keyIndex:ki+1,model:model,modelIndex:mi+1})})});
  return out;
}
function kfRetryable_(code){return code===404||code===408||code===429||code>=500}
function kfSleep_(attempt){
  Utilities.sleep(Math.min(4000,500*Math.pow(2,Math.max(0,attempt-1)))+Math.floor(Math.random()*250));
}

function kfGeminiFailover_(parts, opts) {
  opts=opts||{};
  var targets=kfTargets_();
  if(!targets.length)throw new Error('GEMINI_API_KEY belum diisi di Script Properties.');
  var payload={
    contents:[{role:'user',parts:parts}],
    generationConfig:{responseMimeType:opts.json===false?'text/plain':'application/json'}
  };
  var attempts=[],max=Math.min(targets.length,6);
  for(var i=0;i<max;i++){
    var t=targets[i];
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(t.model)+':generateContent?key='+encodeURIComponent(t.key);
    var r;
    try{
      r=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
    }catch(fetchErr){
      attempts.push({model:t.model,key:t.keyIndex,code:'network'});
      if(i<max-1){kfSleep_(i+1);continue}
      throw new Error('Gemini tidak dapat dihubungi setelah failover.');
    }
    var code=r.getResponseCode();
    if(code<300){
      var j=JSON.parse(r.getContentText());
      var raw=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(function(x){return x.text||''}).join('');
      if(!raw)throw new Error('Gemini mengembalikan respons kosong.');
      return {text:raw,model:t.model,keySlot:t.keyIndex,attempts:attempts.concat([{model:t.model,key:t.keyIndex,code:code}])};
    }
    attempts.push({model:t.model,key:t.keyIndex,code:code});
    if(!kfRetryable_(code)){
      throw new Error('Gemini HTTP '+code+'. Periksa konfigurasi API/project.');
    }
    if(i<max-1)kfSleep_(i+1);
  }
  var last=attempts[attempts.length-1]||{};
  throw new Error('Semua target Gemini sedang tidak tersedia/kuota penuh. Terakhir HTTP '+(last.code||'?')+'. Coba lagi nanti atau periksa quota/billing project.');
}
function kfStripFence_(s){return String(s||'').trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'')}

function kfAnalisisWordTryout_(body){
  var prompt=[
    String(body.prompt||body.instruksi||''),
    'Teks/marker dokumen:',String(body.documentText||body.text||''),
    'Kembalikan JSON valid {"questions":[...]}.',
    'Field soal: type, question, options, answer, explanation, question_image_refs, explanation_image_refs.',
    'Gunakan ID gambar hanya bila gambar relevan dengan soal/pembahasan.',
    'Jangan mengganti soal asli dengan soal lain.'
  ].join('\n\n');
  var parts=[{text:prompt}];
  (Array.isArray(body.images)?body.images:[]).slice(0,12).forEach(function(img){
    var mime=String(img&&img.mimeType||'image/png');
    var data=String(img&&img.data||'').replace(/^data:image\/[^;]+;base64,/i,'');
    if(data)parts.push({inlineData:{mimeType:mime,data:data}});
  });
  if(parts.length<2)throw new Error('Gambar soal tidak diterima.');
  var ai=kfGeminiFailover_(parts,{json:true});
  var parsed=JSON.parse(kfStripFence_(ai.text));
  if(!parsed||!Array.isArray(parsed.questions))throw new Error('Gemini tidak mengembalikan questions[].');
  return {ok:true,status:'ok',questions:parsed.questions,model:ai.model,failoverAttempts:ai.attempts.length};
}

function kfGenerateQuestions_(body){
  var count=Math.max(1,Math.min(50,Number(body.jumlah||body.count||1)));
  var prompt=[
    String(body.prompt||body.instruksi||''),
    'Buat '+count+' soal '+String(body.mapel||'Fisika')+'.',
    'Jenjang: '+String(body.jenjang||'')+'. Topik: '+String(body.topik||'')+'. Kesulitan: '+String(body.sulit||body.difficulty||'Sedang')+'.',
    'Jenis: '+String(body.tipe||'pg5')+'.',
    'Kembalikan JSON valid {"questions":[...]}.',
    'Setiap soal berisi type, question, options/opsi, answer/kunci, explanation/pembahasan.',
    'Pembahasan sistematis: Diketahui, Ditanya, Konsep/Persamaan, Penyelesaian, Jawaban akhir.',
    'Rumus gunakan LaTeX $...$. Jangan markdown fence.'
  ].join('\n');
  var ai=kfGeminiFailover_([{text:prompt}],{json:true});
  var parsed=JSON.parse(kfStripFence_(ai.text));
  if(!parsed||!Array.isArray(parsed.questions))throw new Error('Gemini tidak mengembalikan questions[].');
  return {ok:true,status:'ok',questions:parsed.questions,model:ai.model,failoverAttempts:ai.attempts.length};
}
function kfAssistant_(body){
  var prompt=String(body.prompt||body.text||body.instruksi||'').trim();
  if(!prompt)return {ok:true,status:'ok',message:'OK',text:'OK'};
  var ai=kfGeminiFailover_([{text:prompt}],{json:false});
  return {ok:true,status:'ok',text:ai.text,model:ai.model,failoverAttempts:ai.attempts.length};
}

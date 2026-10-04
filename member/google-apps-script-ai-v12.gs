/**
 * KlinikFisikapku — handler tambahan untuk Google Apps Script V12.
 *
 * CARA PAKAI:
 * 1. Tempel fungsi-fungsi ini ke project Apps Script V12 yang SUDAH memiliki doPost/auth Super Admin.
 * 2. Di Script Properties simpan:
 *      OPENAI_API_KEY = ...     (untuk ChatGPT)
 *      GEMINI_API_KEY = ...     (untuk Gemini)
 * 3. Pada router action Anda, arahkan action "generateAI" ke kfGenerateAI_(body).
 *
 * PENTING: jangan taruh API key di HTML/GitHub.
 */
function kfGenerateAI_(body) {
  var provider = String(body.provider || 'gemini').toLowerCase();
  var count = Math.max(1, Math.min(10, Number(body.jumlah || 1)));
  var schemaInstruction = [
    'Kembalikan JSON valid berbentuk {"questions":[...]}.',
    'Setiap soal wajib: type, jenjang, mapel, kelas, difficulty, topik, question, opsi, kunci, pembahasan, score, scoring.',
    'type hanya pg5, pg4, mcma, kategori, isian, esai.',
    'Untuk pg4/pg5/mcma, opsi adalah array string dan kunci menggunakan huruf A-E.',
    'Untuk semua soal berikan pembahasan yang benar dan cukup untuk belajar.',
    'Gunakan LaTeX dengan delimiter $...$ bila ada rumus.',
    'Jangan sertakan markdown fence.'
  ].join('\n');
  var prompt = [
    'Buat '+count+' soal '+String(body.mapel || 'Fisika')+'.',
    'Jenjang: '+String(body.jenjang || ''),
    'Topik: '+String(body.topik || ''),
    'Jenis: '+String(body.tipe || 'pg5'),
    'Kesulitan: '+String(body.sulit || 'Sedang'),
    String(body.instruksi || ''),
    schemaInstruction
  ].join('\n');

  var raw = provider === 'openai' ? kfOpenAI_(prompt) : kfGemini_(prompt);
  var parsed = JSON.parse(kfStripFence_(raw));
  if (!parsed || !Array.isArray(parsed.questions)) throw new Error('AI tidak mengembalikan questions[].');
  parsed.questions.forEach(function(q){
    q.source = provider === 'openai' ? 'ChatGPT AI' : 'Gemini AI';
  });
  return {ok:true, provider:provider, questions:parsed.questions};
}

function kfOpenAI_(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY belum diisi di Script Properties.');
  var payload = {
    model: 'gpt-5-mini',
    input: [
      {role:'system', content:[{type:'input_text', text:'Anda adalah pembuat soal Fisika Indonesia. Hasil harus akurat, terstruktur, dan siap direview guru.'}]},
      {role:'user', content:[{type:'input_text', text:prompt}]}
    ],
    text: {format:{type:'json_object'}}
  };
  var r = UrlFetchApp.fetch('https://api.openai.com/v1/responses',{
    method:'post',
    contentType:'application/json',
    headers:{Authorization:'Bearer '+key},
    payload:JSON.stringify(payload),
    muteHttpExceptions:true
  });
  if (r.getResponseCode() >= 300) throw new Error('OpenAI HTTP '+r.getResponseCode()+': '+r.getContentText().slice(0,500));
  var j=JSON.parse(r.getContentText());
  if (j.output_text) return j.output_text;
  var out=[];
  (j.output||[]).forEach(function(item){(item.content||[]).forEach(function(x){if(x.text)out.push(x.text);});});
  if(!out.length) throw new Error('Respons OpenAI tidak berisi output text.');
  return out.join('\n');
}

function kfGemini_(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY belum diisi di Script Properties.');
  var model='gemini-2.5-flash';
  var url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(key);
  var payload={
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{responseMimeType:'application/json'}
  };
  var r=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(r.getResponseCode()>=300)throw new Error('Gemini HTTP '+r.getResponseCode()+': '+r.getContentText().slice(0,500));
  var j=JSON.parse(r.getContentText());
  return (((j.candidates||[])[0]||{}).content||{}).parts?.[0]?.text || '';
}

function kfStripFence_(s){
  return String(s||'').trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'');
}


// ============================================================
// KOMPATIBILITAS V12 DENGAN WORKFLOW GEMINI ADMIN LAMA
// Tempel fungsi/route ini ke project Apps Script V12 bila memakai
// Question Engine FINAL-INTEGRATED.
// ============================================================

/**
 * ID model API harus berupa slug, bukan nama tampilan seperti
 * "Gemini 3.6 Flash". Default stabil untuk V12: gemini-2.5-flash.
 */
function kfGeminiModel_() {
  var raw = String(PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || '').trim();
  if (!raw || /\s/.test(raw) || /^Gemini\s/i.test(raw)) return 'gemini-2.5-flash';
  return raw;
}

/**
 * Adapter payload yang sama dengan tombol AI admin lama.
 * Route doPost:
 * if (action === 'buatSoalGemini') return kfBuatSoalGemini_(body, admin.user.id);
 */
function kfBuatSoalGemini_(body, userId) {
  body = body || {};
  body.instruksi = [
    String(body.prompt || body.instruksi || body.material || ''),
    'WAJIB: Buat pembahasan siap pakai dan sistematis untuk setiap soal.',
    'Urutan pembahasan: Diketahui, Ditanya, Konsep fisika/persamaan yang digunakan, Penyelesaian langkah demi langkah, dan Jawaban akhir.',
    'Gunakan LaTeX untuk semua rumus, angka konsisten, serta jangan menulis instruksi untuk admin.'
  ].filter(Boolean).join('\n\n');

  // Memakai generator V12 yang sudah ada agar format hasil tetap kompatibel
  // dengan editor, Bank Soal, Latihan Interaktif, Tryout, dan Supabase.
  return createQuestions_(body, userId);
}


/**
 * Gemini Vision untuk V13 Tempel Soal + Gambar.
 * Router doPost harus mengarahkan:
 * if (action === 'analisisWordTryout') return kfAnalisisWordTryout_(body);
 */
function kfAnalisisWordTryout_(body) {
  body = body || {};
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY belum diisi di Script Properties.');
  var model = kfGeminiModel_();
  var prompt = [
    String(body.prompt || body.instruksi || ''),
    'Teks/marker dokumen:',
    String(body.documentText || body.text || ''),
    'Kembalikan JSON valid {"questions":[...]}.',
    'Setiap question gunakan field: type, question, options (A-E), answer, explanation, question_image_refs.',
    'Untuk question_image_refs gunakan ID gambar yang memang diperlukan oleh soal.',
    'JANGAN membuat soal baru yang berbeda dari gambar.'
  ].join('\n\n');
  var parts = [{text:prompt}];
  (Array.isArray(body.images) ? body.images : []).slice(0,12).forEach(function(img){
    var mime = String(img && img.mimeType || 'image/png');
    var data = String(img && img.data || '').replace(/^data:image\/[^;]+;base64,/i,'');
    if (data) parts.push({inlineData:{mimeType:mime,data:data}});
  });
  if (parts.length < 2) throw new Error('Gambar soal tidak diterima oleh Gemini Vision.');
  var url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key);
  var payload={contents:[{role:'user',parts:parts}],generationConfig:{responseMimeType:'application/json'}};
  var r=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  if(r.getResponseCode()>=300) throw new Error('Gemini Vision HTTP '+r.getResponseCode()+': '+r.getContentText().slice(0,500));
  var j=JSON.parse(r.getContentText());
  var raw=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(function(p){return p.text||'';}).join('');
  var parsed=JSON.parse(kfStripFence_(raw));
  if(!parsed || !Array.isArray(parsed.questions)) throw new Error('Gemini Vision tidak mengembalikan questions[].');
  return {status:'ok',ok:true,questions:parsed.questions};
}

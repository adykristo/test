/* Penilaian Esai V15 — hanya mengganti daftar/penilaian esai di Question Studio. */
(function(){
const $=id=>document.getElementById(id);
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[];
function db(){return window.KFMemberAuth?.client||window.KFSupabaseAdmin?.client}
window.v13LoadEssayGrading=async function(){
 // Capture the deep-link before the Question Studio router removes ?tab= from the URL.
 const deepLink=new URLSearchParams(location.search).get('attempt')||'';
 const sum=$('essayGradeSummary'),box=$('essayGradeList');
 if(sum)sum.textContent='Memuat jawaban esai V15…';
 try{
  if(!db())throw Error('Koneksi Supabase belum tersedia');
  const {data,error}=await db().rpc('kf_admin_list_essay_v15');
  if(error)throw error;
  rows=Array.isArray(data)?data:[];
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deepLink)){
    const search=$('essayGradeSearch'),filter=$('essayGradeFilter');
    if(search)search.value=deepLink;
    if(filter)filter.value='';
  }
  const pending=rows.filter(r=>r.graded_at==null).length;
  if($('essayPendingBadge'))$('essayPendingBadge').textContent=pending;
  if(sum)sum.textContent=pending+' belum dinilai • '+rows.length+' jawaban esai V15';
  window.v13RenderEssayGrading();
 }catch(e){if(sum)sum.textContent='Gagal memuat esai V15: '+e.message+' — Pastikan SQL V15 sudah dijalankan.';if(box)box.innerHTML='';}
};
window.v13RenderEssayGrading=function(){
 const box=$('essayGradeList');if(!box)return;
 const status=$('essayGradeFilter')?.value??'pending',term=($('essayGradeSearch')?.value||'').toLowerCase();
 const filtered=rows.filter(r=>(!status||(status==='graded'?!!r.graded_at:!r.graded_at))&&
 [r.participant_id,r.package_id,r.question_id,r.attempt_id,JSON.stringify(r.answer)].join(' ').toLowerCase().includes(term));
 if(!filtered.length){box.innerHTML='<div class="notice">Tidak ada jawaban esai pada filter ini.</div>';return;}
 box.innerHTML=filtered.map(r=>{
 const ans=r.answer;
 const answerText=typeof ans==='string'?ans:JSON.stringify(ans??{},null,2);
 return '<div class="card" style="margin:12px 0;padding:15px"><b>Peserta:</b> '+safe(r.participant_id)+
 '<div class="small">Paket: '+safe(r.package_id)+' • Soal: '+safe(r.question_id)+'</div>'+
 '<div class="small">Dikirim: '+safe(r.submitted_at?new Date(r.submitted_at).toLocaleString('id-ID'):'-')+'</div>'+
 '<div class="small"><b>ID pengerjaan V15:</b> '+safe(r.attempt_id||'Tidak tersedia')+'</div>'+
 (r.attempt_id?'<div style="margin:8px 0"><a class="btn" href="publikasi-nilai-v15.html?attempt='+encodeURIComponent(String(r.attempt_id))+'">↗ Buka pengerjaan ini di Publikasi Nilai V15</a></div>':'')+
 '<p><b>Jawaban:</b></p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+safe(answerText)+'</pre>'+
 '<label>Nilai <input type="number" min="0" step="0.01" id="kfScore_'+r.answer_id+'" value="'+safe(r.score??'')+'"></label>'+
 '<label>Nilai Maksimum <input type="number" min="0.01" step="0.01" id="kfMax_'+r.answer_id+'" value="'+safe(r.max_score??10)+'"></label>'+
 '<label>Catatan guru <textarea id="kfFeedback_'+r.answer_id+'">'+safe(r.teacher_feedback||'')+'</textarea></label>'+
 '<button class="btn" type="button" data-kf-grade="'+safe(r.answer_id)+'">Simpan &amp; Lanjut</button>'+
 '<span class="small">'+(r.graded_at?'Sudah dinilai':'Belum dinilai')+'</span></div>';
 }).join('');
 box.querySelectorAll('[data-kf-grade]').forEach(b=>b.addEventListener('click',async()=>{
  const id=b.getAttribute('data-kf-grade'),score=Number($('kfScore_'+id)?.value),max=Number($('kfMax_'+id)?.value);
  if(!$('kfScore_'+id)?.value||!Number.isFinite(score)||!Number.isFinite(max)||max<=0||score<0||score>max){alert('Masukkan nilai yang valid (0 sampai maksimum).');return}
  b.disabled=true;
  try{
   const {error}=await db().rpc('kf_admin_grade_essay_v15',{p_answer_id:id,p_score:score,p_max_score:max,p_feedback:$('kfFeedback_'+id)?.value||''});
   if(error)throw error;
   let notice='Nilai esai berhasil disimpan.';
   const current=rows.find(x=>String(x.answer_id)===String(id));
   if(current?.attempt_id){
     try{
       const {data:publish,error:publishError}=await db().rpc('kf_admin_auto_publish_attempt_v16',{p_attempt:current.attempt_id});
       if(publishError)throw publishError;
       notice=publish?.published
         ?('Nilai resmi otomatis diterbitkan: '+Number(publish.score).toFixed(2)+'. Peserta dapat melihat hasilnya pada halaman Nilai & Sertifikat.')
         :('Nilai tersimpan. '+Number(publish?.pending_count||0)+' jawaban masih menunggu penilaian; belum diterbitkan.');
     }catch(pubErr){notice='Nilai esai sudah tersimpan, tetapi penerbitan otomatis belum berhasil: '+pubErr.message+'. Gunakan Publikasi Nilai V15 untuk pemeriksaan.';}
   }
   const summary=$('essayGradeSummary');if(summary)summary.textContent=notice;
   await window.v13LoadEssayGrading();
   if(summary)summary.textContent=notice;
  }catch(e){alert('Gagal menyimpan: '+e.message)}finally{b.disabled=false}
 }));
};
})();
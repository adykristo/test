/* Tahap 2: pendaftaran dan login peserta Supabase. Apps Script tetap fallback. */
(function(){
  const whenReady=()=>{
    if(!window.kfSupabaseReady) return;
    const lama=window.apiPelatihan;
    const waEmail=v => (String(v||'').replace(/\D/g,'').replace(/^0/,'62'))+'@peserta.klinikfisikapku.local';
    window.apiPelatihan=async function(action,data){
      const s=window.kfSupabase;
      if(action==='daftarPelatihan'){
        const r=await s.functions.invoke('pelatihan-auth',{body:{action:'daftar',...(data||{})}});
        if(r.error) return {ok:false,message:r.error.message}; return r.data;
      }
      if(action==='loginPelatihan'){
        const r=await s.auth.signInWithPassword({email:waEmail(data&&data.whatsapp),password:data&&data.password});
        if(r.error) return {ok:false,message:'Nomor WhatsApp atau password belum benar.'};
        return {ok:true,token:r.data.session.access_token,message:'Berhasil masuk.'};
      }
      if(action==='gantiPasswordPelatihan'){
        const r=await s.auth.updateUser({password:data&&data.passwordBaru}); return r.error?{ok:false,message:r.error.message}:{ok:true,message:'Password berhasil diganti.'};
      }
      if(action==='listPaketPelatihan'){
        const r=await s.from('paket_pelatihan').select('id,nama,jenjang,durasi_hari,harga_rupiah,deskripsi').eq('aktif',true).order('harga_rupiah');
        return r.error?{ok:false,message:r.error.message}:{ok:true,paket:(r.data||[]).map(x=>({id:x.id,nama:x.nama,jenjang:x.jenjang,durasi:x.durasi_hari,harga:x.harga_rupiah,deskripsi:x.deskripsi}))};
      }
      return lama ? lama(action,data) : {ok:false,message:'Layanan belum tersedia.'};
    };
  };
  if(document.readyState==='complete') whenReady(); else window.addEventListener('load',whenReady);
})();

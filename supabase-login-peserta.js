/* Login peserta Supabase bertahap. Jika akun belum dipindahkan, login Apps Script lama tetap dipakai. */
(function(){
  const emailPeserta = wa => (String(wa||'').replace(/\D/g,'').replace(/^0/,'62')) + '@peserta.klinikfisikapku.local';
  async function dashboardSupabase(){
    const s=window.kfSupabase, box=document.getElementById('trDashboard'); if(!s||!box)return;
    box.textContent='Memuat kelas dari Supabase…';
    const {data:{user}}=await s.auth.getUser(); if(!user){box.textContent='Sesi peserta tidak ditemukan.';return;}
    const [{data:profil},{data:daftar}]=await Promise.all([
      s.from('profiles').select('nama,whatsapp,sekolah,kelas').eq('id',user.id).maybeSingle(),
      s.from('pendaftaran_pelatihan').select('status,mulai_akses,berakhir_akses,catatan_admin,paket_pelatihan(nama)').eq('peserta_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ]);
    const nama=(profil&&profil.nama)||'Peserta';
    if(!daftar){box.innerHTML='<b>'+nama+'</b><br>Akun Supabase sudah aktif, tetapi akses pelatihan belum dipindahkan Admin.<br><br>Silakan hubungi Admin untuk aktivasi akses.';return;}
    const paket=daftar.paket_pelatihan&&daftar.paket_pelatihan.nama||'Pelatihan';
    box.innerHTML='<b>'+nama+'</b><br>Paket: '+paket+'<br>Status: <b>'+daftar.status+'</b><br>Masa aktif sampai: '+(daftar.berakhir_akses||'—')+(daftar.catatan_admin?'<br><br>'+daftar.catatan_admin:'');
  }
  window.addEventListener('load',function(){
    const loginLama=window.loginPelatihan, gantiLama=window.gantiPasswordPelatihan;
    window.loginPelatihan=async function(){
      const info=document.getElementById('trLoginInfo'), wa=document.getElementById('trLoginWa').value.trim(), password=document.getElementById('trPassword').value;
      if(!wa||!password){info.style.display='block';info.textContent='Isi nomor WhatsApp dan password terlebih dahulu.';return;}
      if(window.kfSupabaseReady&&window.kfSupabase){
        info.style.display='block';info.textContent='Memeriksa akun peserta…';
        const r=await window.kfSupabase.auth.signInWithPassword({email:emailPeserta(wa),password});
        if(!r.error){localStorage.setItem('kf_supabase_peserta','1');info.textContent='Berhasil masuk ke akun peserta.';document.getElementById('trDashboardCard').style.display='block';await dashboardSupabase();return;}
      }
      return loginLama&&loginLama();
    };
    window.gantiPasswordPelatihan=async function(){
      if(window.kfSupabaseReady&&window.kfSupabase){const p=document.getElementById('trPasswordBaru').value;if(p.length<8){alert('Password baru minimal 8 karakter.');return;}const r=await window.kfSupabase.auth.updateUser({password:p});alert(r.error?'Gagal: '+r.error.message:'Password peserta berhasil diganti.');return;}
      return gantiLama&&gantiLama();
    };
  });
})();

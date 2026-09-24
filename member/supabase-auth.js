// supabase-auth.js
(function () {
  if (!window.KF_SUPABASE_CONFIG) {
    console.error("Konfigurasi Supabase tidak ditemukan.");
    return;
  }

  const supabase = window.supabase.createClient(
    window.KF_SUPABASE_CONFIG.url,
    window.KF_SUPABASE_CONFIG.anonKey
  );

  // Mencegah error fungsi login lama[cite: 13]
  window.api = async function (action, payload) {
    if (action === "daftar") {
      // 1. Daftar ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            nama: payload.nama,
            username: payload.username,
            sekolah: payload.sekolah,
            kelas: payload.kelas,
            jenjang: payload.jenjang
          }
        }
      });
      if (authError) throw authError;

      // 2. Data profil secara otomatis dibuat oleh Trigger SQL 'handle_new_user', 
      // namun kita memastikan data tidak ada masalah.
      return { ok: true };
    } 
    
    if (action === "login") {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: payload.username, // Form menggunakan email
        password: payload.password
      });
      if (authError) throw new Error("Email atau password salah.");

      // Ambil Profil Member
      const { data: profile, error: profError } = await supabase
        .from('member_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
        
      if (profError) throw new Error("Profil member gagal dimuat.");
      if (profile.status === 'dihapus') throw new Error("Akun ini telah dihapus.");

      return { ok: true, member: profile };
    }
    
    throw new Error("Aksi publik tidak dikenali: " + action);
  };

  // Object yang diharapkan oleh index(2).html[cite: 13]
  window.KFMemberAuth = {
    configured: true,
    client: supabase,
    
    listPaket: async function () {
      const { data, error } = await supabase
        .from('member_packages')
        .select('*')
        .eq('aktif', true)
        .order('harga', { ascending: true });
      if (error) throw error;
      return { ok: true, data: data };
    },

    // Memuat konten aman berdasarkan jenjang dan Tahap Belajar[cite: 11, 13]
    kontenMember: async function (jenjang) {
      const { data, error } = await supabase.rpc('member_secure_content');
      if (error) throw error;
      
      // Filter di sisi klien untuk memastikan hanya jenjang yang dipilih yang tampil 
      // (meskipun backend sudah memastikan keamanan)
      const filtered = (data || []).filter(item => item.jenjang === jenjang);
      return { ok: true, data: filtered };
    },

    // Sinkronisasi data progres belajar
    dataBelajar: async function () {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return { progress: [], bookmarks: [], attempts: [] };
      const userId = sessionData.session.user.id;

      const [prog, bmk, att] = await Promise.all([
        supabase.from('member_progress').select('*').eq('user_id', userId),
        supabase.from('member_bookmarks').select('*').eq('user_id', userId),
        supabase.from('member_answer_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
      ]);

      return {
        progress: prog.data || [],
        bookmarks: bmk.data || [],
        attempts: att.data || []
      };
    },

    // Melakukan pengecekan kunci dan menyimpan progres langsung ke Server Supabase[cite: 11]
    cekJawaban: async function (contentId, jawaban) {
      const { data, error } = await supabase.rpc('check_member_answer', {
        p_content_id: contentId,
        p_answer: jawaban
      });
      if (error) throw error;
      return data; // returns: { benar, kunci, pembahasan, youtube, review_locked }
    },

    simpanProgress: async function (contentId, data) {
      // Sentuh (touch) progress materi[cite: 11]
      await supabase.rpc('touch_member_content', { p_content_id: contentId });
    },

    setBookmark: async function (contentId, aktif) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (aktif) {
        await supabase.from('member_bookmarks').upsert({ user_id: user.id, content_id: contentId });
      } else {
        await supabase.from('member_bookmarks').delete().match({ user_id: user.id, content_id: contentId });
      }
    }
  };

  // Muat status otomatis jika user terautentikasi (menghindari login ulang)
  window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && document.getElementById('dash')) {
      const { data: profile } = await supabase.from('member_profiles').select('*').eq('id', session.user.id).single();
      if (profile && typeof masukPeserta === 'function' && window.getComputedStyle(document.getElementById('dash')).display === 'none') {
        masukPeserta(profile);
      }
    }
    
    // Tarik config pembayaran dari Supabase (dummy adminGetPaymentSettings map)
    if (document.getElementById('paymentBank')) {
      supabase.from('member_packages').select('deskripsi').eq('nama', '_PAYMENT_CONFIG_').single().then(({data}) => {
         if (data && data.deskripsi) {
             try {
                 const pay = JSON.parse(data.deskripsi);
                 const eBank = document.getElementById('paymentBank');
                 const eNum = document.getElementById('paymentAccountNumber');
                 const eOwn = document.getElementById('paymentAccountOwner');
                 const eWa = document.getElementById('paymentWhatsAppLink');
                 if (eBank) eBank.textContent = pay.bank || "-";
                 if (eNum) eNum.textContent = pay.nomorRekening || "-";
                 if (eOwn) eOwn.textContent = pay.pemilikRekening || "-";
                 if (eWa && pay.whatsapp) {
                    const pkt = localStorage.getItem('kf_member_profile') ? JSON.parse(localStorage.getItem('kf_member_profile')).paket : 'Paket';
                    eWa.href = `https://wa.me/${pay.whatsapp}?text=Halo%20Admin%20KlinikFisikapku,%20saya%20ingin%20mengirim%20bukti%20transfer%20untuk%20aktivasi%20Member%20Area.%0A%0APaket:%20${pkt}`;
                 }
             } catch(e) {}
         }
      });
    }
  });

  // Ekstensi Pemulihan Kata Sandi
  window.kirimResetPassword = async function() {
    const emailStr = document.getElementById('user').value.trim();
    if (!emailStr) {
      alert("Masukkan alamat Email Google Anda pada kolom pengisian terlebih dahulu.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(emailStr, {
      redirectTo: window.location.origin + window.location.pathname + '#reset',
    });
    if (error) alert("Gagal mengirim link reset: " + error.message);
    else alert("Link pemulihan password telah dikirim ke email Anda.");
  };

})();
/* Sinkronisasi ringan ke Supabase. Tidak mengganggu Apps Script saat peserta belum login. */
window.kfSupabaseTryout = {
  async call(action, payload) {
    if (!window.kfSupabaseReady || !window.kfSupabase) return { ok:false, offline:true };
    const { data: sessionData } = await window.kfSupabase.auth.getSession();
    if (!sessionData.session) return { ok:false, offline:true };
    const result = await window.kfSupabase.functions.invoke('tryout-api', { body:{ action, ...(payload || {}) } });
    return result.error ? {ok:false,message:result.error.message} : (result.data || {ok:false});
  },
  simpanProgres(kontenId, status) { return this.call('progres',{kontenId,status}); },
  simpanJawaban(upayaId, jawaban) { return this.call('autosave',{upayaId,jawaban}); },
  riwayat() { return this.call('riwayat'); }
};

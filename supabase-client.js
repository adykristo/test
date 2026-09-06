/* Konektor browser. Seluruh hak akses tetap dibatasi oleh Row Level Security. */
(function () {
  const c = window.KF_SUPABASE_CONFIG;
  if (!c || !c.enabled || !c.url || !c.publishableKey || !window.supabase) return;
  window.kfSupabase = window.supabase.createClient(c.url, c.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.kfSupabaseReady = true;
  window.dispatchEvent(new CustomEvent('kf:supabase-ready'));
})();

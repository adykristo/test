// File: supabase-config.js
// Konfigurasi Utama untuk menghubungkan web KlinikFisikapku ke Supabase

window.KF_SUPABASE_CONFIG = {
  // 1. Project URL (Salin dari Dashboard Supabase -> Project Settings -> API)
  // Contoh format: "https://abcdefghijklmnopqrst.supabase.co"
  url: "https://spxprgwkpjkusnoviofi.supabase.co", 

  // 2. Project API Key - anon/public (Salin dari Dashboard Supabase -> Project Settings -> API)
  // PENTING: Gunakan kunci berlabel 'anon' atau 'public'. JANGAN gunakan 'service_role'.
  // Contoh format: "eyJhbGciOiJIUzI1NiIsIn..."
  anonKey: "sb_publishable_LYLDlwmx-joblC8ls6dB0w_XpZyP4gt",

  // 3. Mode Lingkungan (Biarkan false saat sudah diluncurkan ke siswa)
  demoMode: false,
  testMode: false
};

// Penanda di Console untuk memastikan file ini sudah terbaca
console.log("File konfigurasi Supabase berhasil dimuat.");

// Validasi ringan agar file lain dapat memberi pesan konfigurasi yang jelas.
(function () {
  var cfg = window.KF_SUPABASE_CONFIG || {};
  cfg.url = String(cfg.url || "").trim().replace(/\/+$/, "");
  cfg.anonKey = String(cfg.anonKey || "").trim();
  cfg.isValid =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url) &&
    cfg.anonKey.length >= 20 &&
    !/service_role/i.test(cfg.anonKey);
  window.KF_SUPABASE_CONFIG = cfg;
  if (!cfg.isValid) {
    console.error("[KlinikFisikapku] Konfigurasi Supabase belum valid.");
  }
})();

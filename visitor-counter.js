/*
 * Visitor Counter for GitHub Pages CBT
 * Uses GoatCounter's public counter API endpoint through an image beacon.
 * No PHP/MySQL is required.
 *
 * SETUP:
 * 1. Create a free GoatCounter site.
 * 2. Replace GOATCOUNTER_CODE below with your site code.
 * 3. Include this file before </body>.
 */
(function () {
  "use strict";

  const GOATCOUNTER_CODE = "GANTI_DENGAN_KODE_GOATCOUNTER";
  const SITE_KEY = location.hostname || "localhost";

  // Local counter for the admin dashboard UI.
  // This does not claim to be the authoritative total; it is a fallback
  // when no external analytics endpoint is configured.
  const today = new Date().toISOString().slice(0, 10);
  const key = "cbt_visitor_" + SITE_KEY + "_" + today;

  try {
    const old = Number(localStorage.getItem(key) || "0");
    localStorage.setItem(key, String(old + 1));
  } catch (_) {}

  // External analytics beacon.
  // GoatCounter records pageviews without requiring a server on GitHub Pages.
  if (
    GOATCOUNTER_CODE &&
    !GOATCOUNTER_CODE.startsWith("GANTI_") &&
    location.protocol !== "file:"
  ) {
    const img = new Image();
    const path = location.pathname + location.search;
    img.src =
      "https://" +
      GOATCOUNTER_CODE +
      ".goatcounter.com/count?p=" +
      encodeURIComponent(path) +
      "&t=" +
      encodeURIComponent(document.title || "CBT");
    img.width = 1;
    img.height = 1;
    img.style.position = "absolute";
    img.style.left = "-9999px";
    document.body.appendChild(img);
  }
})();

/**
 * gemini-question-studio — optimasi performa
 * - import npm native (cold start lebih stabil)
 * - env & CORS di-cache di level modul
 * - auth + rate-limit paralel (Promise.all)
 * - baca body paralel dengan auth
 * - maxOutputTokens dinamis (hemat latency Gemini)
 * - log usage non-blocking (EdgeRuntime.waitUntil)
 * - persistSession/autoRefresh mati (hemat di edge)
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL_RAW = Deno.env.get("GEMINI_MODEL") || "";

const RULES = `Anda editor soal KlinikFisikapku. Akurat konsep/matematika/satuan SI. Bahasa Indonesia baku. Rumus LaTeX $...$ atau $$...$$.
Tipe: pg4,pg5,mcma,kategori,isian,esai. pg4/pg5: kunci indeks dari 0. mcma: array indeks. kategori: statements[{text,key}]+category_labels. isian/esai: kunci teks. Wajib pembahasan.
JSON: {"questions":[{"tipe":"pg4","soal":"...","opsi":["..."],"kunci":0,"pembahasan":"...","statements":[],"category_labels":[],"diagram_svg":"","peringatan":[]}]}`;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED.length && origin && !ALLOWED.includes(origin)) {
    throw new Error("Origin tidak diizinkan");
  }
  return {
    "Access-Control-Allow-Origin": origin || ALLOWED[0] || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cleanJson(text: string) {
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function imageParts(images: unknown) {
  if (!Array.isArray(images) || !images.length) return [];
  let total = 0;
  const out: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const src of images.slice(0, 8)) {
    const m = String(src || "").match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) continue;
    if (!["image/jpeg", "image/png", "image/webp"].includes(m[1])) {
      throw new Error("Format gambar tidak diizinkan");
    }
    total += m[2].length;
    if (total > 8_000_000) throw new Error("Total gambar terlalu besar");
    out.push({ inlineData: { mimeType: m[1], data: m[2] } });
  }
  return out;
}

function questionPrompt(action: string, p: Record<string, unknown>) {
  const o = (p.options as Record<string, unknown>) || {};
  const wants = `terjemah=${!!o.translate};validasi=${o.validate !== false};bahas=${o.explain !== false};variasi=${!!o.variation};diagram=${!!o.diagram}`;
  if (action === "adminBuatSoalGemini") {
    const n = Math.max(1, Math.min(20, Number(p.jumlah) || 1));
    return `${RULES}
Buat ${n} soal ${p.tipe || "pg4"} jenjang ${p.jenjang || "SMA"} topik ${p.topik || "Fisika"} tingkat ${p.sulit || "Sedang"}.
Instruksi: ${String(p.instruksi || "Soal berkualitas").slice(0, 4000)}
${wants}`;
  }
  if (action === "adminAnalisisWordGemini") {
    return `${RULES}
Ubah bahan jadi soal terstruktur. Jenjang ${p.jenjang || "SMA"}, topik ${p.topik || ""}.
Pertahankan gambar relevan. ${wants}
BAHAN:
${String(p.text || "").slice(0, 100_000)}`;
  }
  return `${RULES}
Rapikan satu soal tanpa ubah kompetensi. Satu kunci benar untuk PG. ${wants}
SOAL:
${JSON.stringify(p.item || p).slice(0, 60_000)}`;
}

function extractParams(body: Record<string, unknown>) {
  const action = String(body.action || "");
  if (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)) {
    return { action, p: body.payload as Record<string, unknown> };
  }
  const p = { ...body };
  delete p.action;
  return { action, p };
}

async function authorizeAdmin(authHeader: string) {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Sesi admin tidak valid.");
  const userId = userData.user.id;
  const since = new Date(Date.now() - 3_600_000).toISOString();

  const [roleRes, usageRes] = await Promise.all([
    admin.from("member_admins").select("user_id, active").eq("user_id", userId).maybeSingle(),
    admin
      .from("member_ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", userId)
      .gte("created_at", since),
  ]);

  if (!roleRes.data || roleRes.data.active === false) {
    throw new Error("Akun tidak memiliki hak Admin Member.");
  }
  if ((usageRes.count || 0) >= 40) {
    throw new Error("Batas 40 permintaan AI per jam tercapai. Coba kembali nanti.");
  }
  return { admin, userId };
}

function logUsage(
  admin: SupabaseClient,
  userId: string,
  action: string,
  model: string,
  itemCount: number,
) {
  const task = admin.from("member_ai_usage").insert({
    admin_id: userId,
    action,
    model,
    item_count: itemCount,
  });
  // @ts-expect-error EdgeRuntime di Supabase Edge
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-expect-error
    EdgeRuntime.waitUntil(Promise.resolve(task).catch(() => {}));
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders(req) });
    }
    if (req.method !== "POST") {
      return json(req, { ok: false, error: "Metode tidak diizinkan" }, 405);
    }
    if (Number(req.headers.get("content-length") || 0) > 9_000_000) {
      throw new Error("Permintaan AI terlalu besar");
    }
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY belum dipasang pada Supabase Secrets.");
    if (!GEMINI_MODEL_RAW) throw new Error("GEMINI_MODEL belum dipasang pada Supabase Secrets.");
    const model = GEMINI_MODEL_RAW.replace(/^models\//, "");
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(model)) throw new Error("GEMINI_MODEL tidak valid.");

    // Auth berjalan bersamaan dengan baca body
    const authPromise = authorizeAdmin(req.headers.get("Authorization") || "");
    const requestText = await req.text();
    if (requestText.length > 9_000_000) throw new Error("Permintaan AI terlalu besar");

    const body = JSON.parse(requestText) as Record<string, unknown>;
    const { action, p } = extractParams(body);
    const { admin, userId } = await authPromise;

    const ALLOWED_ACTIONS = new Set([
      "adminBuatSoalGemini",
      "adminAnalisisWordGemini",
      "adminRapikanSoalGemini",
      "adminAsistenSoal",
    ]);
    if (!ALLOWED_ACTIONS.has(action)) throw new Error("Aksi AI tidak dikenali.");

    let prompt: string;
    let assistant = false;
    let maxTokens = 8192;

    if (action === "adminAsistenSoal") {
      assistant = true;
      maxTokens = 4096;
      const map: Record<string, string> = {
        variasi: "Buat variasi bermakna",
        solusi: "Solusi langkah demi langkah",
        osn: "Analisis level OSN dan strategi",
        audit: "Audit konsep, satuan, opsi, kunci",
      };
      const tugas = map[String(p.jenis || "")] || "Analisis soal";
      prompt = `Asisten soal Fisika. ${tugas}. Bahasa Indonesia + LaTeX. Jenjang ${p.jenjang || "SMA"}, topik ${p.topik || ""}.\n\n${String(p.text || "").slice(0, 40_000)}`;
    } else {
      if (action === "adminBuatSoalGemini") {
        const n = Math.max(1, Math.min(20, Number(p.jumlah) || 1));
        maxTokens = Math.min(32_768, 1200 * n + 2048);
      } else if (action === "adminAnalisisWordGemini") {
        maxTokens = 16_384;
      } else {
        maxTokens = 4096; // rapikan 1 soal
      }
      prompt = questionPrompt(action, p);
    }

    const parts = [{ text: prompt }, ...imageParts(p.images)];
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: assistant ? 0.35 : 0.25,
      maxOutputTokens: maxTokens,
    };
    if (!assistant) generationConfig.responseMimeType = "application/json";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    });

    const geminiData = await response.json();
    if (!response.ok) {
      throw new Error(geminiData?.error?.message || "Gemini gagal memproses permintaan.");
    }

    const text =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((x: { text?: string }) => x.text || "")
        .join("") || "";
    if (!text) throw new Error("Gemini tidak mengembalikan hasil.");

    logUsage(admin, userId, action, model, Number(p.jumlah) || 0);

    if (assistant) {
      return json(req, { ok: true, analysis: text.slice(0, 100_000) });
    }

    const parsed = cleanJson(text);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    if (!Array.isArray(questions) || !questions.length || questions.length > 40) {
      throw new Error("Format atau jumlah hasil Gemini tidak valid.");
    }
    for (const q of questions) {
      if (
        !q ||
        typeof q !== "object" ||
        String((q as { soal?: string }).soal || "").length > 30_000 ||
        JSON.stringify(q).length > 150_000
      ) {
        throw new Error("Salah satu soal AI terlalu besar atau tidak valid.");
      }
    }

    if (action === "adminRapikanSoalGemini") {
      return json(req, { ok: true, item: questions[0] });
    }
    return json(req, { ok: true, data: questions, questions, jumlah: questions.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("gemini-question-studio", message);
    try {
      return json(req, { ok: false, error: message }, 400);
    } catch {
      return new Response('{"ok":false,"error":"Permintaan ditolak"}', {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
});

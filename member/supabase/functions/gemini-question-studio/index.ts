import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function corsFor(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map(x => x.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) throw new Error("Origin tidak diizinkan");
  return {
    "Access-Control-Allow-Origin": origin || allowed[0] || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

const cleanJson = (text: string) =>
  JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));

function imageParts(images: unknown) {
  if (!Array.isArray(images)) return [];
  let total = 0;
  return images.slice(0, 8).flatMap((src) => {
    const m = String(src || "").match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) return [];
    if (!["image/jpeg", "image/png", "image/webp"].includes(m[1])) throw new Error("Format gambar tidak diizinkan");
    total += m[2].length;
    if (total > 8000000) throw new Error("Total gambar terlalu besar");
    return [{ inlineData: { mimeType: m[1], data: m[2] } }];
  });
}

function rules() {
  return `Anda adalah editor soal KlinikFisikapku dan ahli pendidikan Indonesia.
Keluaran harus akurat secara konsep, matematika, satuan SI, bahasa, opsi, dan kunci.
Gunakan Bahasa Indonesia baku. Tulis rumus sebagai LaTeX di antara $...$ atau $$...$$.
Tipe yang diizinkan: pg4, pg5, mcma, kategori, isian, esai.
- pg4/pg5: kunci adalah indeks angka mulai 0.
- mcma: kunci adalah array indeks jawaban benar; boleh lebih dari satu.
- kategori: statements adalah array {text,key}; category_labels minimal dua label.
- isian/esai: kunci berupa teks/pedoman atau rubrik.
Setiap soal wajib memiliki pembahasan sistematis. Jangan mengarang fakta yang tidak dapat diverifikasi.
Jika menemukan keraguan, isi peringatan dengan penjelasan singkat. Jika diagram diperlukan, berikan diagram_svg sederhana, valid, berlatar putih, tanpa skrip.
Kembalikan JSON saja: {"questions":[{"tipe":"pg4","soal":"...","opsi":["..."],"kunci":0,"pembahasan":"...","statements":[],"category_labels":[],"diagram_svg":"","peringatan":[],"metadata":{"kompetensi":"","kesulitan":"","estimasi_menit":2}}]}.`;
}

function questionPrompt(action: string, p: any) {
  const o = p.options || {};
  const wants = `Terjemahkan=${!!o.translate}; validasi=${o.validate !== false}; buat pembahasan=${o.explain !== false}; variasi=${!!o.variation}; diagram=${!!o.diagram}; hanya gambar relevan=${o.relevantImages !== false}.`;
  if (action === "adminBuatSoalGemini")
    return `${rules()}\nBuat ${Math.max(1, Math.min(20, Number(p.jumlah) || 1))} soal ${p.tipe || "pg4"} untuk jenjang ${p.jenjang || "SMA"}, topik ${p.topik || "Fisika"}, tingkat ${p.sulit || "Sedang"}. Instruksi: ${p.instruksi || "Buat soal berkualitas."}\n${wants}\nJika variasi aktif, setiap soal utama boleh diikuti satu soal variasi yang tetap berbeda secara bermakna.`;
  if (action === "adminAnalisisWordGemini")
    return `${rules()}\nUbah bahan berikut menjadi daftar soal terstruktur untuk jenjang ${p.jenjang || "SMA"}, topik ${p.topik || ""}. Pertahankan gambar yang relevan sesuai urutannya. Pecah nomor, tipe, opsi, pernyataan kategori, kunci, rumus, dan pembahasan. Koreksi hanya bila perlu dan catat perubahan penting di peringatan.\n${wants}\nBAHAN:\n${String(p.text || "").slice(0, 120000)}`;
  return `${rules()}\nAudit dan rapikan satu soal berikut tanpa mengubah tujuan kompetensinya. Pastikan hanya satu jawaban benar untuk PG biasa, pengecoh masuk akal, serta pembahasan konsisten.\nSOAL JSON:\n${JSON.stringify(p.item || p).slice(0, 70000)}`;
}

Deno.serve(async (req) => {
  try {
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json(req, { ok: false, error: "Metode tidak diizinkan" }, 405);
    if (Number(req.headers.get("content-length") || 0) > 9000000) throw new Error("Permintaan AI terlalu besar");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } }
    });
    const { data: { user }, error: userError } = await auth.auth.getUser();
    if (userError || !user) throw new Error("Sesi admin tidak valid.");

    const admin = createClient(url, service);
    const { data: role } = await admin.from("member_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!role) throw new Error("Akun tidak memiliki hak Admin Member.");

    const since = new Date(Date.now() - 3600000).toISOString();
    const { count } = await admin.from("member_ai_usage").select("id", { count: "exact", head: true }).eq("admin_id", user.id).gte("created_at", since);
    if ((count || 0) >= 40) throw new Error("Batas 40 permintaan AI per jam tercapai. Coba kembali nanti.");

    const requestText = await req.text();
    if (requestText.length > 9000000) throw new Error("Permintaan AI terlalu besar");
    const body = JSON.parse(requestText);
    const action = String(body.action || "");
    const p = body.payload || {};

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY belum dipasang pada Supabase Secrets.");
    const configuredModel = Deno.env.get("GEMINI_MODEL");
    if (!configuredModel) throw new Error("GEMINI_MODEL belum dipasang pada Supabase Secrets.");
    const model = configuredModel.replace(/^models\//, "");
    if (!/^[A-Za-z0-9._-]{3,100}$/.test(model)) throw new Error("GEMINI_MODEL tidak valid.");

    let prompt = "";
    let assistant = false;

    if (action === "adminAsistenSoal") {
      assistant = true;
      const tugas = {
        variasi: "Buat beberapa variasi bermakna dari soal/instruksi",
        solusi: "Susun solusi langkah demi langkah dan periksa hasil akhir",
        osn: "Analisis level OSN, konsep inti, jebakan, dan strategi penyelesaian",
        audit: "Audit konsep, data, satuan, bahasa, opsi, kunci, dan keadilan soal"
      }[p.jenis] || "Analisis soal";
      prompt = `Anda adalah asisten penyusun soal Fisika. ${tugas}. Gunakan Bahasa Indonesia dan LaTeX. Jenjang ${p.jenjang || "SMA"}, topik ${p.topik || ""}.\n\n${String(p.text || "").slice(0, 50000)}`;
    } else if (!["adminBuatSoalGemini", "adminAnalisisWordGemini", "adminRapikanSoalGemini"].includes(action)) {
      throw new Error("Aksi AI tidak dikenali.");
    } else {
      prompt = questionPrompt(action, p);
    }

    const parts = [{ text: prompt }, ...imageParts(p.images)];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const generationConfig: any = {
      temperature: assistant ? 0.35 : 0.25,
      maxOutputTokens: 32768
    };
    if (!assistant) generationConfig.responseMimeType = "application/json";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig })
    });

    const geminiData = await response.json();
    if (!response.ok) throw new Error(geminiData?.error?.message || "Gemini gagal memproses permintaan.");

    const text = geminiData?.candidates?.[0]?.content?.parts?.map((x: any) => x.text || "").join("") || "";
    if (!text) throw new Error("Gemini tidak mengembalikan hasil.");

    await admin.from("member_ai_usage").insert({
      admin_id: user.id,
      action,
      model,
      item_count: Number(p.jumlah) || 0
    });

    if (assistant) return json(req, { ok: true, analysis: text.slice(0, 200000) });

    const parsed = cleanJson(text);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    if (!Array.isArray(questions) || !questions.length || questions.length > 40) {
      throw new Error("Format atau jumlah hasil Gemini tidak valid.");
    }

    for (const q of questions) {
      if (!q || typeof q !== "object" || String(q.soal || "").length > 30000 || JSON.stringify(q).length > 150000) {
        throw new Error("Salah satu soal AI terlalu besar atau tidak valid.");
      }
    }

    if (action === "adminRapikanSoalGemini") return json(req, { ok: true, item: questions[0] });
    return json(req, { ok: true, data: questions, questions, jumlah: questions.length });

  } catch (error: any) {
    console.error("gemini-question-studio", error);
    try {
      return json(req, { ok: false, error: String(error?.message || error) }, 400);
    } catch {
      return new Response('{"ok":false,"error":"Permintaan ditolak"}', {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
});
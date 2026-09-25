/**
 * admin-user-management — optimasi performa
 * - import npm native
 * - env/CORS di-cache
 * - list admin: getUserById paralel (Promise.all)
 * - client tanpa persist session
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(req: Request): Record<string, string> {
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

const reply = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors(req) });
    }
    if (req.method !== "POST") {
      return reply(req, { ok: false, error: "Metode tidak diizinkan" }, 405);
    }

    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await auth.auth.getUser();
    if (userError || !user) throw new Error("Sesi admin tidak valid");

    const { data: owner } = await admin
      .from("member_admins")
      .select("role, active")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owner || !owner.active || owner.role !== "super_admin") {
      throw new Error("Hanya Admin Utama yang dapat mengelola admin");
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data: rows, error } = await admin
        .from("member_admins")
        .select("user_id, role, display_name, active, created_at")
        .order("created_at");
      if (error) throw error;

      // Parallel lookup — jauh lebih cepat dari loop serial
      const users = await Promise.all(
        (rows || []).map(async (row) => {
          try {
            const { data: u } = await admin.auth.admin.getUserById(row.user_id);
            return { ...row, email: u?.user?.email || "" };
          } catch {
            return { ...row, email: "" };
          }
        }),
      );
      return reply(req, { ok: true, data: users });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.display_name || "").trim();
      const password = String(body.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Email admin tidak valid");
      }
      if (name.length < 2 || name.length > 100) {
        throw new Error("Nama admin harus 2–100 karakter");
      }
      if (password.length < 10) {
        throw new Error("Password sementara minimal 10 karakter");
      }

      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nama: name, admin_role: "content_admin" },
      });
      if (created.error) throw created.error;

      const id = created.data.user!.id;
      const { error } = await admin.from("member_admins").insert({
        user_id: id,
        role: "content_admin",
        display_name: name,
        active: true,
      });
      if (error) {
        await admin.auth.admin.deleteUser(id);
        throw error;
      }

      // Cleanup profil siswa + log — paralel
      await Promise.all([
        admin.from("member_profiles").delete().eq("id", id),
        admin.from("member_admin_logs").insert({
          admin_id: user.id,
          aksi: "tambah_admin_konten",
          target_type: "admin",
          target_id: id,
          detail: { email, display_name: name },
        }),
      ]);

      return reply(req, {
        ok: true,
        data: {
          user_id: id,
          email,
          display_name: name,
          role: "content_admin",
          active: true,
        },
      });
    }

    if (action === "set_active") {
      const id = String(body.user_id || "");
      const active = body.active === true;
      if (id === user.id) {
        throw new Error("Admin Utama tidak dapat menonaktifkan dirinya sendiri");
      }
      const { data: target, error: findError } = await admin
        .from("member_admins")
        .select("role")
        .eq("user_id", id)
        .single();
      if (findError) throw findError;
      if (target.role !== "content_admin") {
        throw new Error("Hanya Admin Konten yang dapat diubah");
      }

      const [{ error }] = await Promise.all([
        admin.from("member_admins").update({ active }).eq("user_id", id),
        admin.from("member_admin_logs").insert({
          admin_id: user.id,
          aksi: active ? "aktifkan_admin_konten" : "nonaktifkan_admin_konten",
          target_type: "admin",
          target_id: id,
          detail: {},
        }),
      ]);
      if (error) throw error;
      return reply(req, { ok: true });
    }

    throw new Error("Aksi tidak dikenali");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("admin-user-management", message);
    try {
      return reply(req, { ok: false, error: message }, 400);
    } catch {
      return new Response('{"ok":false,"error":"Permintaan ditolak"}', {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
});

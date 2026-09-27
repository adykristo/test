// KlinikFisikapku - admin-user-management
// Supabase Edge Function
// Kompatibel dengan frontend yang mengirim:
// { action: "adminCreateAdmin", payload: {...} }
// maupun { action: "adminCreateAdmin", display_name: ..., ... }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://klinikfisikapku.com")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

function cors(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "https://klinikfisikapku.com";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return reply({ ok: false, error: "Method tidak diizinkan." }, 405, origin);
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return reply({ ok: false, error: "Origin tidak diizinkan." }, 403, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(
      { ok: false, error: "Konfigurasi Edge Function belum lengkap." },
      500,
      origin,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return reply(
      { ok: false, error: "Sesi Super Admin tidak ditemukan." },
      401,
      origin,
    );
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const serviceClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    // Validasi JWT.
    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);

    if (authError || !authData.user) {
      return reply(
        { ok: false, error: "Sesi admin tidak valid atau kedaluwarsa." },
        401,
        origin,
      );
    }

    // Validasi Super Admin menggunakan service client agar pengecekan ini
    // tidak bergantung pada policy SELECT browser.
    const { data: caller, error: callerError } = await serviceClient
      .from("member_admins")
      .select("user_id,role,active")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (
      callerError ||
      !caller ||
      caller.role !== "super_admin" ||
      caller.active !== true
    ) {
      return reply(
        {
          ok: false,
          error: "Hanya Super Admin aktif yang dapat mengelola admin.",
        },
        403,
        origin,
      );
    }

    let raw: Record<string, unknown>;
    try {
      raw = await req.json();
    } catch {
      return reply({ ok: false, error: "Body JSON tidak valid." }, 400, origin);
    }

    // Frontend KlinikFisikapku dapat membungkus data di "payload".
    const nested =
      raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {};

    // Nilai nested dan top-level sama-sama diterima.
    const input: Record<string, unknown> = { ...nested, ...raw };

    const actionRaw = String(raw.action ?? input.action ?? "adminCreateAdmin");
    const action = actionRaw.trim().toLowerCase();

    // ------------------------------------------------------------
    // LIST ADMIN
    // ------------------------------------------------------------
    if (
      ["adminlistadmins", "list", "list_admins", "list-admins"].includes(action)
    ) {
      const { data: rows, error } = await serviceClient
        .from("member_admins")
        .select("user_id,display_name,role,active,created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const usersResult = await serviceClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (usersResult.error) throw usersResult.error;

      const emailMap = new Map(
        (usersResult.data.users ?? []).map((u) => [u.id, u.email ?? ""]),
      );

      return reply(
        {
          ok: true,
          data: (rows ?? []).map((r) => ({
            ...r,
            email: emailMap.get(r.user_id) ?? "",
          })),
        },
        200,
        origin,
      );
    }

    // ------------------------------------------------------------
    // CREATE ADMIN KONTEN
    // ------------------------------------------------------------
    if (
      [
        "admincreateadmin",
        "admincreatecontentadmin",
        "create",
        "create_admin",
        "create-admin",
      ].includes(action)
    ) {
      const displayName = String(
        input.display_name ??
          input.displayName ??
          input.name ??
          "",
      ).trim();

      const email = String(input.email ?? "").trim().toLowerCase();
      const password = String(
        input.password ??
          input.initial_password ??
          input.initialPassword ??
          "",
      );

      if (displayName.length < 2 || displayName.length > 100) {
        return reply(
          { ok: false, error: "Nama admin harus 2-100 karakter." },
          400,
          origin,
        );
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply(
          { ok: false, error: "Email admin tidak valid." },
          400,
          origin,
        );
      }

      if (password.length < 8) {
        return reply(
          { ok: false, error: "Password awal minimal 8 karakter." },
          400,
          origin,
        );
      }

      // UI ini hanya boleh membuat Admin Konten.
      const role = "content_admin";

      const { data: created, error: createError } =
        await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: displayName,
            source: "klinikfisikapku_admin",
          },
        });

      if (createError || !created.user) {
        return reply(
          {
            ok: false,
            error: createError?.message ?? "Akun Auth admin gagal dibuat.",
          },
          400,
          origin,
        );
      }

      const newUserId = created.user.id;

      // RPC dijalankan dengan JWT Super Admin agar auth.uid() tetap benar.
      const { error: profileError } = await userClient.rpc(
        "admin_upsert_admin_profile",
        {
          p_user_id: newUserId,
          p_display_name: displayName,
          p_role: role,
          p_active: true,
        },
      );

      if (profileError) {
        const { error: rollbackError } =
          await serviceClient.auth.admin.deleteUser(newUserId);

        return reply(
          {
            ok: false,
            error:
              "Akun Auth dibatalkan karena profil admin gagal dibuat: " +
              profileError.message +
              (rollbackError
                ? ". Rollback Auth gagal: " + rollbackError.message
                : ""),
          },
          500,
          origin,
        );
      }

      return reply(
        {
          ok: true,
          message: "Admin Konten berhasil dibuat.",
          data: {
            user_id: newUserId,
            email,
            display_name: displayName,
            role,
            active: true,
          },
        },
        200,
        origin,
      );
    }

    // ------------------------------------------------------------
    // AKTIFKAN / NONAKTIFKAN ADMIN KONTEN
    // ------------------------------------------------------------
    if (
      ["adminsetadminactive", "set_active", "set-active"].includes(action)
    ) {
      const userId = String(input.user_id ?? input.userId ?? "").trim();
      const active =
        input.active === true ||
        String(input.active ?? "").toLowerCase() === "true";

      if (!userId) {
        return reply(
          { ok: false, error: "User ID admin tidak ditemukan." },
          400,
          origin,
        );
      }

      const { data: target, error: targetError } = await serviceClient
        .from("member_admins")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) {
        return reply(
          { ok: false, error: "Admin tidak ditemukan." },
          404,
          origin,
        );
      }
      if (target.role === "super_admin") {
        return reply(
          { ok: false, error: "Super Admin utama dilindungi." },
          403,
          origin,
        );
      }

      const { error } = await serviceClient
        .from("member_admins")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("role", "content_admin");

      if (error) throw error;

      return reply(
        {
          ok: true,
          message: active
            ? "Admin Konten berhasil diaktifkan."
            : "Admin Konten berhasil dinonaktifkan.",
        },
        200,
        origin,
      );
    }

    // ------------------------------------------------------------
    // HAPUS ADMIN KONTEN + AKUN AUTH
    // ------------------------------------------------------------
    if (
      ["admindeleteadmin", "delete", "delete_admin", "delete-admin"].includes(
        action,
      )
    ) {
      const userId = String(input.user_id ?? input.userId ?? "").trim();

      if (!userId) {
        return reply(
          { ok: false, error: "User ID admin tidak ditemukan." },
          400,
          origin,
        );
      }

      const { data: target, error: targetError } = await serviceClient
        .from("member_admins")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) {
        return reply(
          { ok: false, error: "Admin tidak ditemukan." },
          404,
          origin,
        );
      }
      if (target.role === "super_admin") {
        return reply(
          { ok: false, error: "Super Admin utama tidak boleh dihapus." },
          403,
          origin,
        );
      }

      // Hapus profil terlebih dahulu, lalu akun Auth.
      const { error: profileDeleteError } = await serviceClient
        .from("member_admins")
        .delete()
        .eq("user_id", userId)
        .eq("role", "content_admin");

      if (profileDeleteError) throw profileDeleteError;

      const { error: authDeleteError } =
        await serviceClient.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        return reply(
          {
            ok: false,
            error:
              "Profil admin sudah dihapus, tetapi akun Auth gagal dihapus: " +
              authDeleteError.message,
          },
          500,
          origin,
        );
      }

      return reply(
        { ok: true, message: "Admin Konten berhasil dihapus." },
        200,
        origin,
      );
    }

    return reply(
      { ok: false, error: `Aksi admin tidak dikenali: ${actionRaw}` },
      400,
      origin,
    );
  } catch (err) {
    console.error("admin-user-management:", err);
    return reply(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan pada server.",
      },
      500,
      origin,
    );
  }
});

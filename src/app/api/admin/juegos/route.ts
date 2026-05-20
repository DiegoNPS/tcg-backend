import { z } from "zod";

import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  nombre: z.string().trim().min(2).max(100),
  key: z.string().trim().min(2).max(100).optional(),
  descripcion: z.string().trim().max(250).optional().nullable(),
});

function toKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.user_role !== "admin") {
    return Response.json({ error: "No tienes permisos para crear juegos" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ error: "Admin client no disponible. Configura SUPABASE_SERVICE_ROLE." }, { status: 501 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const key = parsed.data.key ? toKey(parsed.data.key) : toKey(parsed.data.nombre);

  try {
    const { data, error } = await admin
      .from("juegos")
      .insert({
        key,
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "Ya existe un juego con esa clave." }, { status: 409 });
      }

      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 201 });
  } catch {
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

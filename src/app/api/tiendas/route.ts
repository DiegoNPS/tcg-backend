/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const createTiendaSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  ciudad: z.string().trim().min(1).max(200),
});

function resolveRpcUuid(value: unknown): string | null {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "id" in first) {
      const id = (first as { id?: unknown }).id;
      return typeof id === "string" ? id : null;
    }
  }

  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = createTiendaSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos de tienda inválidos" }, { status: 400 });
  }

  const { data: ciudadRes, error: ciudadErr } = await supabase.rpc("get_or_create_ciudad", {
    p_nombre: parsed.data.ciudad,
  } as any);
  if (ciudadErr) return Response.json({ error: "No se pudo resolver la ciudad" }, { status: 500 });
  const ciudad_id = resolveRpcUuid(ciudadRes);

  if (!ciudad_id) {
    return Response.json({ error: "No se pudo resolver la ciudad" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("tiendas")
    .insert({
      owner_id: user.id,
      nombre: parsed.data.nombre,
      ciudad_id,
    } as any)
    .select("id, owner_id, nombre, ciudad_id, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Tu usuario ya tiene una tienda asociada" }, { status: 409 });
    }

    return Response.json({ error: error.message }, { status: 400 });
  }

  const ciudadName = ((await supabase.from("ciudades").select("nombre").eq("id", ciudad_id).maybeSingle()) as any).data?.nombre ?? null;

  const payload = (data ?? {}) as any;
  payload.ciudad = ciudadName;

  return Response.json({ data: payload }, { status: 201 });
}

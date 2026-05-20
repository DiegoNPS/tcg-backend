/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const createTiendaSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  ciudad: z.string().trim().min(1).max(200),
});

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

  // resolve ciudad id
  const { data: ciudadRes, error: ciudadErr } = await supabase.rpc("get_or_create_ciudad", { p_nombre: parsed.data.ciudad } as any);
  if (ciudadErr) return Response.json({ error: "No se pudo resolver la ciudad" }, { status: 500 });
  const ciudadResAny = ciudadRes as any;
  const ciudad_id = Array.isArray(ciudadResAny) ? ciudadResAny[0]?.id ?? null : ciudadResAny?.id ?? null;

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
    return Response.json({ error: error.message }, { status: 400 });
  }

  // expand ciudad name for compatibility
    const ciudadName = ciudad_id
      ? ((await supabase.from("ciudades").select("nombre").eq("id", ciudad_id).maybeSingle()) as any).data?.nombre
      : null;

    const payload = (data ?? {}) as any;
    payload.ciudad = ciudadName;

    return Response.json({ data: payload }, { status: 201 });
}
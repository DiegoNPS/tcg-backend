import { z } from "zod";

import { getAdminContext } from "@/lib/auth/admin";
import createAdminClient from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();
const updateSchema = z.object({
  publicado: z.boolean(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { user, isAdmin } = await getAdminContext();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isAdmin) {
    return Response.json({ error: "Acceso restringido" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json({ error: "ID de torneo inválido" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Servicio administrativo no disponible" },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("torneos")
    .update({ publicado: parsed.data.publicado })
    .eq("id", parsedId.data)
    .select("id, titulo, publicado")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "No se pudo actualizar el torneo" }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return Response.json({ data }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { user, isAdmin } = await getAdminContext();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isAdmin) {
    return Response.json({ error: "Acceso restringido" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json({ error: "ID de torneo invalido" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Servicio administrativo no disponible" },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("torneos")
    .delete()
    .eq("id", parsedId.data)
    .select("id, titulo")
    .maybeSingle();

  if (error) {
    return Response.json({ error: "No se pudo eliminar el torneo" }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return Response.json({ data }, { status: 200 });
}

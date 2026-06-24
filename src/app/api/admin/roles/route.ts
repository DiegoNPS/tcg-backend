import { z } from "zod";

import { getAdminContext } from "@/lib/auth/admin";
import createAdminClient from "@/lib/supabase/admin";

const schema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["jugador", "tienda", "admin"]),
});

export async function POST(request: Request) {
  const { user, isAdmin } = await getAdminContext();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isAdmin) {
    return Response.json({ error: "Acceso restringido" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.user_id === user.id && parsed.data.role !== "admin") {
    return Response.json(
      { error: "No puedes quitar tu propio acceso de administrador." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Servicio administrativo no disponible." },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await admin
      .from("profiles")
      .upsert(
        { user_id: parsed.data.user_id, user_role: parsed.data.role },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 200 });
  } catch {
    return Response.json({ error: "Error interno" }, { status: 500 });
  }
}

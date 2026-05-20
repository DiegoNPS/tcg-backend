import { z } from "zod";

import createAdminClient from "@/lib/supabase/admin";

const schema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["jugador", "tienda", "admin"]),
});

export async function POST(request: Request) {
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

  try {
    const { data, error } = await admin
      .from("profiles")
      .upsert({ user_id: parsed.data.user_id, user_role: parsed.data.role }, { onConflict: "user_id" })
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

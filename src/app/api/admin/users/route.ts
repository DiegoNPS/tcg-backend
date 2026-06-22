import { z } from "zod";

import { getAdminContext } from "@/lib/auth/admin";
import createAdminClient from "@/lib/supabase/admin";

const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).optional(),
  user_metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  const { user, isAdmin } = await getAdminContext();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isAdmin) {
    return Response.json({ error: "Acceso restringido" }, { status: 403 });
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

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    // use admin auth API to create user
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      user_metadata: parsed.data.user_metadata,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 201 });
  } catch {
    return Response.json({ error: "No se pudo crear usuario" }, { status: 500 });
  }
}

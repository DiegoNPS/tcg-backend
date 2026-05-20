import { z } from "zod";

import createAdminClient from "@/lib/supabase/admin";

const confirmSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(6).max(128),
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

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    // Use admin API to update user's password. Supabase admin typings vary by version.
    // @ts-expect-error admin typings may differ
    const { data, error } = await admin.auth.admin.updateUser(parsed.data.user_id, {
      password: parsed.data.new_password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ data }, { status: 200 });
  } catch {
    return Response.json({ error: "No se pudo actualizar la contraseña" }, { status: 500 });
  }
}

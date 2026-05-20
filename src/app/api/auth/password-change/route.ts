import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const changeSchema = z.object({
  new_password: z.string().min(6).max(128),
});

export async function PUT(request: Request) {
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

  const parsed = changeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    // Update password for currently authenticated user
    // supabase.auth.updateUser is supported in the server client
    const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ message: "Contraseña actualizada" }, { status: 200 });
  } catch {
    return Response.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
  }
}

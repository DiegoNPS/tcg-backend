import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const confirmSchema = z.object({
  user_id: z.string().uuid().optional(),
  new_password: z.string().min(6).max(128),
});

export async function POST(request: Request) {
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

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json(
      { error: "El enlace de recuperación no es válido o ya expiró." },
      { status: 401 },
    );
  }

  if (parsed.data.user_id && parsed.data.user_id !== user.id) {
    return Response.json({ error: "No puedes modificar esta cuenta." }, { status: 403 });
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    await supabase.auth.signOut();

    return Response.json(
      { data, message: "Contraseña actualizada" },
      { status: 200 },
    );
  } catch {
    return Response.json({ error: "No se pudo actualizar la contraseña" }, { status: 500 });
  }
}

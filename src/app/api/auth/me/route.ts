import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const [{ data: profile }, { data: tienda }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, user_role, created_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("tiendas")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  return Response.json(
    {
      data: {
        user: {
          id: user.id,
          email: user.email ?? null,
        },
        profile: profile ?? null,
        isTienda: Boolean(tienda),
      },
    },
    { status: 200 },
  );
}

const updateProfileSchema = z.object({
  display_name: z.string().trim().optional(),
  // user_role is accepted by the client but changing roles is restricted.
  user_role: z.enum(["jugador", "tienda", "admin"]).optional(),
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

  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Read current profile to detect role changes
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentProfileError) {
    return Response.json({ error: "No se pudo leer el perfil" }, { status: 400 });
  }

  // Prevent users from changing their own role. Role changes must be performed by an admin/service process.
  if (parsed.data.user_role && parsed.data.user_role !== currentProfile?.user_role) {
    return Response.json(
      { error: "Cambio de rol restringido. Contacta a un administrador." },
      { status: 403 },
    );
  }

  const toUpsert = {
    user_id: user.id,
    display_name: parsed.data.display_name ?? null,
    // preserve existing role (do not write user_role from client)
    user_role: currentProfile?.user_role ?? undefined,
  } as {
    user_id: string;
    display_name?: string | null;
    user_role?: "jugador" | "tienda" | "admin" | undefined;
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(toUpsert, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return Response.json({ error: "No se pudo actualizar el perfil" }, { status: 400 });
  }

  return Response.json({ data }, { status: 200 });
}

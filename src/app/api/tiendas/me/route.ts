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

  const { data: tienda, error } = await supabase
    .from("tiendas")
    .select("id, nombre, ciudad_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "No se pudo cargar la tienda" }, { status: 500 });
  }

  if (!tienda) {
    return Response.json({ data: null }, { status: 200 });
  }

  let ciudad: string | null = null;
  if (tienda.ciudad_id) {
    const { data: ciudadRow } = await supabase
      .from("ciudades")
      .select("nombre")
      .eq("id", tienda.ciudad_id)
      .maybeSingle();
    ciudad = ciudadRow?.nombre ?? null;
  }

  return Response.json(
    {
      data: {
        id: tienda.id,
        nombre: tienda.nombre,
        ciudad,
      },
    },
    { status: 200 },
  );
}

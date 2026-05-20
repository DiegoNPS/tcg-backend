import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);

  if (!parsed.success) {
    return Response.json({ error: "ID de torneo inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: torneo, error } = await supabase
    .from("torneos")
    .select(
      "id, tienda_id, titulo, descripcion, juego_id, categoria_id, direccion, fecha_inicio, cupo_maximo, costo_entrada, imagen_url, latitud, longitud, publicado",
    )
    .eq("id", parsed.data)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "No se pudo consultar el torneo" }, { status: 500 });
  }

  if (!torneo) {
    return Response.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("owner_id")
    .eq("id", torneo.tienda_id)
    .maybeSingle();

  if (!tienda || tienda.owner_id !== user.id) {
    return Response.json({ error: "No tienes acceso a este torneo" }, { status: 403 });
  }

  let tcgJuego: string | null = null;
  if (torneo.juego_id) {
    const { data: juego } = await supabase
      .from("juegos")
      .select("key")
      .eq("id", torneo.juego_id)
      .maybeSingle();
    tcgJuego = juego?.key ?? null;
  }

  let categoria: string | null = null;
  if (torneo.categoria_id) {
    const { data: cat } = await supabase
      .from("categorias_torneo")
      .select("key")
      .eq("id", torneo.categoria_id)
      .maybeSingle();
    categoria = cat?.key ?? null;
  }

  return Response.json(
    {
      data: {
        id: torneo.id,
        titulo: torneo.titulo,
        descripcion: torneo.descripcion,
        direccion: torneo.direccion,
        fecha_inicio: torneo.fecha_inicio,
        cupo_maximo: torneo.cupo_maximo,
        costo_entrada: torneo.costo_entrada,
        publicado: torneo.publicado,
        latitud: torneo.latitud,
        longitud: torneo.longitud,
        imagen_url: torneo.imagen_url,
        tcg_juego: tcgJuego,
        categoria,
      },
    },
    { status: 200 },
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const torneoAny = torneo as any;

  if (!torneoAny || !torneoAny.publicado) {
    return Response.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const { data: tienda } = await supabase
    .from("tiendas")
    .select("nombre, ciudad_id")
    .eq("id", torneoAny.tienda_id)
    .maybeSingle();

  // Resolve names
  const juego = torneoAny.juego_id ? await supabase.from("juegos").select("key").eq("id", torneoAny.juego_id).maybeSingle() : null;
  const categoria = torneoAny.categoria_id ? await supabase.from("categorias_torneo").select("key").eq("id", torneoAny.categoria_id).maybeSingle() : null;
  const ciudad = tienda?.ciudad_id
    ? await supabase.from("ciudades").select("nombre").eq("id", tienda.ciudad_id).maybeSingle()
    : null;

  return Response.json(
    {
      data: {
        ...torneoAny,
        tienda_nombre: tienda?.nombre ?? null,
        tcg_juego: (juego as any)?.data?.key ?? null,
        categoria: (categoria as any)?.data?.key ?? null,
        ciudad: (ciudad as any)?.data?.nombre ?? null,
      },
    },
    { status: 200 },
  );
}
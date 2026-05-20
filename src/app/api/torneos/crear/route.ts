/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const crearTorneoSchema = z.object({
  titulo: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().min(1).max(1200),
  juego_id: z.string().uuid().optional(),
  categoria_id: z.string().uuid().optional(),
  direccion: z.string().trim().min(1).max(500),
  fecha_inicio: z.string().min(1, "La fecha es requerida"),
  cupo_maximo: z.coerce.number().int().min(2, "Mínimo 2 jugadores").max(1024),
  costo_entrada: z.coerce.number().min(0, "No puede ser negativo").max(1_000_000),
  publicado: z.boolean().optional(),
  latitud: z.number().optional().nullable(),
  longitud: z.number().optional().nullable(),
  imagen_url: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  // Get user's store
  const { data: tienda, error: tiendaError } = await supabase
    .from("tiendas")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (tiendaError || !tienda) {
    return Response.json(
      { error: "No tienes tienda asociada" },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = crearTorneoSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const first = issues?.[0];
      if (first) fieldErrors[key] = first;
    }
    return Response.json({ error: "Datos inválidos", fieldErrors }, { status: 400 });
  }

  const fecha = new Date(parsed.data.fecha_inicio);
  if (Number.isNaN(fecha.getTime())) {
    return Response.json({ error: "Fecha no válida" }, { status: 400 });
  }

  const juego_id: string | null = parsed.data.juego_id ?? null;
  const categoria_id: string | null = parsed.data.categoria_id ?? null;

  const { data, error } = await supabase
    .from("torneos")
    .insert({
      tienda_id: (tienda as any).id,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion,
      juego_id,
      categoria_id,
      direccion: parsed.data.direccion,
      fecha_inicio: fecha.toISOString(),
      cupo_maximo: parsed.data.cupo_maximo,
      costo_entrada: parsed.data.costo_entrada,
      publicado: parsed.data.publicado ?? false,
      latitud: parsed.data.latitud ?? null,
      longitud: parsed.data.longitud ?? null,
      imagen_url: parsed.data.imagen_url || null,
    } as any)
    .select()
    .single();

  if (error) {
    return Response.json({ error: "No se pudo crear el torneo" }, { status: 400 });
  }

  return Response.json({ data }, { status: 201 });
}

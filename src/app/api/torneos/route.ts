/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

import { CATEGORIA_OPTIONS } from "@/lib/constants";
import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { CategoriaTorneo } from "@/types/database.types";
const validCategorias = new Set<CategoriaTorneo>(
  CATEGORIA_OPTIONS.map((option) => option.value),
);

const querySchema = z.object({
  juego: z.string().optional(),
  categoria: z.string().optional(),
  ciudad: z.string().trim().max(100).optional(),
});

function isCategoriaTorneo(value: string): value is CategoriaTorneo {
  return validCategorias.has(value as CategoriaTorneo);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    juego: url.searchParams.get("juego") ?? undefined,
    categoria: url.searchParams.get("categoria") ?? undefined,
    ciudad: url.searchParams.get("ciudad") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Parámetros de búsqueda inválidos" },
      { status: 400 },
    );
  }

  const { juego, categoria, ciudad } = parsed.data;

  if (categoria && !isCategoriaTorneo(categoria)) {
    return Response.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const juegoFiltro: string | undefined = juego?.trim() || undefined;
  const categoriaFiltro: CategoriaTorneo | undefined =
    categoria && isCategoriaTorneo(categoria) ? categoria : undefined;

  const supabase = await createClient();
  const metadataClient = createAdminClient() ?? supabase;

  let juegoId: string | null = null;
  if (juegoFiltro) {
    const { data: jdata } = await (supabase.from("juegos").select("id").eq("key", juegoFiltro).limit(1).maybeSingle() as any);
    juegoId = (jdata as any)?.id ?? null;
    if (!juegoId) return Response.json({ data: [] }, { status: 200 });
  }

  let categoriaId: string | null = null;
  if (categoriaFiltro) {
    const { data: cdata } = await (supabase.from("categorias_torneo").select("id").eq("key", categoriaFiltro).limit(1).maybeSingle() as any);
    categoriaId = (cdata as any)?.id ?? null;
    if (!categoriaId) return Response.json({ data: [] }, { status: 200 });
  }

  let tiendaIdsForCiudad: string[] | null = null;
  if (ciudad) {
    const { data: cids } = await metadataClient.from("ciudades").select("id").ilike("nombre", `%${ciudad}%`);
    const ciudadIds = (cids ?? []).map((r: any) => r.id);
    if (ciudadIds.length === 0) return Response.json({ data: [] }, { status: 200 });

    const { data: tiendas } = await metadataClient.from("tiendas").select("id").in("ciudad_id", ciudadIds);
    tiendaIdsForCiudad = (tiendas ?? []).map((t: any) => t.id);
    if (tiendaIdsForCiudad.length === 0) return Response.json({ data: [] }, { status: 200 });
  }

  let query = supabase
    .from("torneos")
    .select(
      "id, tienda_id, titulo, descripcion, juego_id, categoria_id, direccion, fecha_inicio, cupo_maximo, costo_entrada, imagen_url, latitud, longitud",
    )
    .eq("publicado", true)
    .order("fecha_inicio", { ascending: true });

  if (juegoId) query = query.eq("juego_id", juegoId);
  if (categoriaId) query = query.eq("categoria_id", categoriaId);
  if (tiendaIdsForCiudad) query = query.in("tienda_id", tiendaIdsForCiudad);

  const { data: torneos, error: torneosError } = await query as any;

  if (torneosError) {
    return Response.json({ error: "No se pudieron cargar los torneos" }, { status: 500 });
  }

  const torneosList = (torneos ?? []) as any[];
  const tiendaIds = Array.from(new Set(torneosList.map((torneo) => torneo.tienda_id)));
  const tiendaMap = new Map<string, string>();
  let tiendas: any[] = [];

  if (tiendaIds.length > 0) {
    const { data: tiendasData, error: tiendasError } = await metadataClient
      .from("tiendas")
      .select("id, nombre, ciudad_id")
      .in("id", tiendaIds);

    if (tiendasError) {
      return Response.json({ error: "No se pudieron cargar las tiendas" }, { status: 500 });
    }

    tiendas = tiendasData ?? [];
    tiendas.forEach((tienda: any) => {
      tiendaMap.set(tienda.id, tienda.nombre);
    });
  }

  // intermediate `items` removed; building `finalItems` below

  // Resolve names for juegos, categorias and ciudades
  const juegoIdsAll = Array.from(new Set(torneosList.map((t) => t.juego_id).filter(Boolean)));
  const categoriaIdsAll = Array.from(new Set(torneosList.map((t) => t.categoria_id).filter(Boolean)));
  const ciudadIdsAll = Array.from(new Set(tiendas.map((t: any) => t.ciudad_id).filter(Boolean)));

  const juegosMap = new Map<string, string>();
  if (juegoIdsAll.length > 0) {
    const { data: juegos } = await metadataClient.from("juegos").select("id, key").in("id", juegoIdsAll);
    (juegos ?? []).forEach((j: any) => juegosMap.set(j.id, j.key));
  }

  const categoriasMap = new Map<string, string>();
  if (categoriaIdsAll.length > 0) {
    const { data: categorias } = await metadataClient.from("categorias_torneo").select("id, key").in("id", categoriaIdsAll);
    (categorias ?? []).forEach((c: any) => categoriasMap.set(c.id, c.key));
  }

  const ciudadesMap = new Map<string, string>();
  if (ciudadIdsAll.length > 0) {
    const { data: ciudades } = await metadataClient.from("ciudades").select("id, nombre").in("id", ciudadIdsAll);
    (ciudades ?? []).forEach((c: any) => ciudadesMap.set(c.id, c.nombre));
  }

  const finalItems = torneosList.map((torneo) => {
    const tienda = tiendas.find((t: any) => t.id === torneo.tienda_id);
    return {
      ...torneo,
      tienda_nombre: tiendaMap.get(torneo.tienda_id) ?? null,
      tcg_juego: torneo.juego_id ? juegosMap.get(torneo.juego_id) ?? null : null,
      categoria: torneo.categoria_id ? categoriasMap.get(torneo.categoria_id) ?? null : null,
      ciudad: tienda?.ciudad_id ? ciudadesMap.get(tienda.ciudad_id) ?? null : null,
    };
  });

  return Response.json({ data: finalItems }, { status: 200 });
}

import { createClient } from "@/lib/supabase/server";

type TorneoRow = {
  id: string;
  titulo: string;
  fecha_inicio: string;
  juego_id: string | null;
  categoria_id: string | null;
  publicado: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: tienda, error: tiendaError } = await supabase
    .from("tiendas")
    .select("id, ciudad_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (tiendaError) {
    return Response.json({ error: "No se pudo cargar la tienda" }, { status: 500 });
  }

  if (!tienda) {
    return Response.json({ data: [] }, { status: 200 });
  }

  const { data: torneos, error } = await supabase
    .from("torneos")
    .select("id, titulo, fecha_inicio, juego_id, categoria_id, publicado")
    .eq("tienda_id", tienda.id)
    .order("fecha_inicio", { ascending: false });

  if (error) {
    return Response.json({ error: "No se pudieron cargar los torneos" }, { status: 500 });
  }

  const torneosList = (torneos ?? []) as TorneoRow[];

  let ciudadName: string | null = null;
  if (tienda.ciudad_id) {
    const { data: ciudadRow } = await supabase
      .from("ciudades")
      .select("nombre")
      .eq("id", tienda.ciudad_id)
      .maybeSingle();
    ciudadName = ciudadRow?.nombre ?? null;
  }

  const juegoIds = Array.from(
    new Set(torneosList.map((t) => t.juego_id).filter(Boolean)),
  ) as string[];
  const categoriaIds = Array.from(
    new Set(torneosList.map((t) => t.categoria_id).filter(Boolean)),
  ) as string[];

  const juegoMap = new Map<string, string>();
  if (juegoIds.length > 0) {
    const { data: juegos } = await supabase
      .from("juegos")
      .select("id, key")
      .in("id", juegoIds);
    (juegos ?? []).forEach((j) => juegoMap.set(j.id, j.key));
  }

  const categoriaMap = new Map<string, string>();
  if (categoriaIds.length > 0) {
    const { data: categorias } = await supabase
      .from("categorias_torneo")
      .select("id, key")
      .in("id", categoriaIds);
    (categorias ?? []).forEach((c) => categoriaMap.set(c.id, c.key));
  }

  const enriched = torneosList.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    fecha_inicio: t.fecha_inicio,
    publicado: t.publicado,
    tcg_juego: t.juego_id ? juegoMap.get(t.juego_id) ?? null : null,
    categoria: t.categoria_id ? categoriaMap.get(t.categoria_id) ?? null : null,
    ciudad: ciudadName,
  }));

  return Response.json({ data: enriched }, { status: 200 });
}

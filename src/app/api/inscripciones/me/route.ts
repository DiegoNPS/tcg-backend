import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type TorneoRow = {
  id: string;
  titulo: string;
  fecha_inicio: string | null;
  tienda_id: string | null;
  costo_entrada: number | null;
};

type TiendaRow = {
  id: string;
  nombre: string;
  ciudad_id: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const metadataClient = createAdminClient() ?? supabase;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeTorneo = url.searchParams.get("include") === "torneo";

  const { data, error } = await supabase
    .from("tournament_entries")
    .select("id, torneo_id, status, entry_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json(
      { error: "No se pudieron cargar las inscripciones" },
      { status: 500 },
    );
  }

  const entries = data ?? [];

  if (!includeTorneo) {
    return Response.json({ data: entries }, { status: 200 });
  }

  const torneoIds = Array.from(new Set(entries.map((e) => e.torneo_id)));
  const torneosMap = new Map<string, TorneoRow>();
  const tiendaNombreMap = new Map<string, string>();
  const tiendaCiudadMap = new Map<string, string | null>();
  const ciudadMap = new Map<string, string>();

  if (torneoIds.length > 0) {
    const { data: torneos } = await supabase
      .from("torneos")
      .select("id, titulo, fecha_inicio, tienda_id, costo_entrada")
      .in("id", torneoIds);

    const torneosList = (torneos ?? []) as TorneoRow[];
    torneosList.forEach((t) => torneosMap.set(t.id, t));

    const tiendaIds = Array.from(
      new Set(torneosList.map((t) => t.tienda_id).filter(Boolean)),
    ) as string[];

    if (tiendaIds.length > 0) {
      const { data: tiendas } = await metadataClient
        .from("tiendas")
        .select("id, nombre, ciudad_id")
        .in("id", tiendaIds);

      const tiendasList = (tiendas ?? []) as TiendaRow[];
      tiendasList.forEach((tienda) => {
        tiendaNombreMap.set(tienda.id, tienda.nombre);
        tiendaCiudadMap.set(tienda.id, tienda.ciudad_id);
      });

      const ciudadIds = Array.from(
        new Set(tiendasList.map((t) => t.ciudad_id).filter(Boolean)),
      ) as string[];

      if (ciudadIds.length > 0) {
        const { data: ciudades } = await metadataClient
          .from("ciudades")
          .select("id, nombre")
          .in("id", ciudadIds);
        (ciudades ?? []).forEach((c) => ciudadMap.set(c.id, c.nombre));
      }
    }
  }

  const enriched = entries.map((entry) => {
    const torneo = torneosMap.get(entry.torneo_id);
    const tiendaId = torneo?.tienda_id ?? null;
    const ciudadId = tiendaId ? tiendaCiudadMap.get(tiendaId) ?? null : null;
    return {
      id: entry.id,
      torneo_id: entry.torneo_id,
      status: entry.status,
      entry_type: entry.entry_type,
      created_at: entry.created_at,
      torneo: torneo
        ? {
            id: torneo.id,
            titulo: torneo.titulo,
            fecha_inicio: torneo.fecha_inicio,
            tienda_nombre: tiendaId ? tiendaNombreMap.get(tiendaId) ?? null : null,
            ciudad: ciudadId ? ciudadMap.get(ciudadId) ?? null : null,
            costo_entrada: torneo.costo_entrada,
          }
        : null,
    };
  });

  return Response.json({ data: enriched }, { status: 200 });
}

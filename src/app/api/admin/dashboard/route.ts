import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type TournamentRow = {
  id: string;
  titulo: string;
  publicado: boolean;
  fecha_inicio: string;
  tienda_id: string;
};

type StoreRow = {
  id: string;
  nombre: string;
  ciudad_id: string | null;
  owner_id: string;
  created_at: string;
};

function hasError(results: { error: unknown }[]) {
  return results.some((result) => Boolean(result.error));
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.user_role !== "admin") {
    return Response.json({ error: "Acceso restringido" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      { error: "Service role no configurado", code: "missing-service-role" },
      { status: 503 },
    );
  }

  const [
    profilesCount,
    storesCount,
    tournamentsCount,
    entriesCount,
    gamesCount,
    draftsCount,
    profilesWithoutRoleCount,
    usersResult,
    gamesResult,
    recentTournamentsResult,
    draftTournamentsResult,
    recentStoresResult,
  ] = await Promise.all([
    admin.from("profiles").select("user_id", { count: "exact", head: true }),
    admin.from("tiendas").select("id", { count: "exact", head: true }),
    admin.from("torneos").select("id", { count: "exact", head: true }),
    admin.from("tournament_entries").select("id", { count: "exact", head: true }),
    admin.from("juegos").select("id", { count: "exact", head: true }),
    admin.from("torneos").select("id", { count: "exact", head: true }).eq("publicado", false),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).is("user_role", null),
    admin.auth.admin.listUsers({ page: 1, perPage: 8 }),
    admin.from("juegos").select("id, key, nombre, descripcion, created_at").order("nombre"),
    admin
      .from("torneos")
      .select("id, titulo, publicado, fecha_inicio, tienda_id")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("torneos")
      .select("id, titulo, publicado, fecha_inicio, tienda_id")
      .eq("publicado", false)
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("tiendas")
      .select("id, nombre, ciudad_id, owner_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (
    hasError([
      profilesCount,
      storesCount,
      tournamentsCount,
      entriesCount,
      gamesCount,
      draftsCount,
      profilesWithoutRoleCount,
      usersResult,
      gamesResult,
      recentTournamentsResult,
      draftTournamentsResult,
      recentStoresResult,
    ])
  ) {
    return Response.json(
      { error: "No se pudo cargar la información administrativa" },
      { status: 500 },
    );
  }

  const authUsers = usersResult.data.users;
  const userIds = authUsers.map((recentUser) => recentUser.id);
  const recentTournaments = (recentTournamentsResult.data ?? []) as TournamentRow[];
  const draftTournaments = (draftTournamentsResult.data ?? []) as TournamentRow[];
  const recentStores = (recentStoresResult.data ?? []) as StoreRow[];
  const relatedStoreIds = Array.from(
    new Set([
      ...recentStores.map((store) => store.id),
      ...recentTournaments.map((tournament) => tournament.tienda_id),
      ...draftTournaments.map((tournament) => tournament.tienda_id),
    ]),
  );

  const [profilesResult, relatedStoresResult] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("user_id, user_role").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    relatedStoreIds.length
      ? admin.from("tiendas").select("id, nombre, ciudad_id").in("id", relatedStoreIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || relatedStoresResult.error) {
    return Response.json(
      { error: "No se pudieron resolver los datos relacionados" },
      { status: 500 },
    );
  }

  const relatedStores = relatedStoresResult.data ?? [];
  const cityIds = Array.from(
    new Set(relatedStores.map((store) => store.ciudad_id).filter((id): id is string => Boolean(id))),
  );
  const citiesResult = cityIds.length
    ? await admin.from("ciudades").select("id, nombre").in("id", cityIds)
    : { data: [], error: null };

  if (citiesResult.error) {
    return Response.json(
      { error: "No se pudieron resolver las ciudades" },
      { status: 500 },
    );
  }

  const profileRoleByUser = new Map(
    (profilesResult.data ?? []).map((item) => [item.user_id, item.user_role]),
  );
  const storeById = new Map(relatedStores.map((store) => [store.id, store]));
  const cityById = new Map((citiesResult.data ?? []).map((city) => [city.id, city.nombre]));

  const enrichTournament = (tournament: TournamentRow) => {
    const store = storeById.get(tournament.tienda_id);
    return {
      ...tournament,
      tienda_nombre: store?.nombre ?? "Tienda no disponible",
      ciudad: store?.ciudad_id ? cityById.get(store.ciudad_id) ?? null : null,
    };
  };

  return Response.json(
    {
      data: {
        generatedAt: new Date().toISOString(),
        counts: {
          profiles: profilesCount.count ?? 0,
          tiendas: storesCount.count ?? 0,
          torneos: tournamentsCount.count ?? 0,
          entries: entriesCount.count ?? 0,
          juegos: gamesCount.count ?? 0,
        },
        attention: {
          draftTournaments: draftsCount.count ?? 0,
          profilesWithoutRole: profilesWithoutRoleCount.count ?? 0,
        },
        juegos: gamesResult.data ?? [],
        recentUsers: authUsers.map((recentUser) => ({
          id: recentUser.id,
          email: recentUser.email ?? null,
          created_at: recentUser.created_at ?? null,
          email_confirmed_at: recentUser.email_confirmed_at ?? null,
          role: profileRoleByUser.get(recentUser.id) ?? null,
        })),
        recentTorneos: recentTournaments.map(enrichTournament),
        draftTournaments: draftTournaments.map(enrichTournament),
        recentStores: recentStores.map((store) => {
          const relatedStore = storeById.get(store.id);
          return {
            id: store.id,
            nombre: store.nombre,
            owner_id: store.owner_id,
            created_at: store.created_at,
            ciudad: relatedStore?.ciudad_id
              ? cityById.get(relatedStore.ciudad_id) ?? null
              : null,
          };
        }),
      },
    },
    { status: 200 },
  );
}

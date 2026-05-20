import createAdminClient from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type JuegoRow = {
  id: string;
  key: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
};

type RecentTorneo = {
  id: string;
  titulo: string;
  publicado: boolean;
  fecha_inicio: string;
  tienda_id: string;
};

type RecentStore = {
  id: string;
  nombre: string;
  ciudad_id: string | null;
  owner_id: string;
};

type RecentUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  email_confirmed_at: string | null;
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
    tiendasCount,
    torneosCount,
    entriesCount,
    gamesCount,
    usersResult,
    juegosResult,
    recentTorneosResult,
    recentStoresResult,
  ] = await Promise.all([
    admin.from("profiles").select("user_id", { count: "exact", head: true }),
    admin.from("tiendas").select("id", { count: "exact", head: true }),
    admin.from("torneos").select("id", { count: "exact", head: true }),
    admin
      .from("tournament_entries")
      .select("id", { count: "exact", head: true }),
    admin.from("juegos").select("id", { count: "exact", head: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 8 }),
    admin
      .from("juegos")
      .select("id, key, nombre, descripcion, created_at")
      .order("nombre", { ascending: true }),
    admin
      .from("torneos")
      .select("id, titulo, publicado, fecha_inicio, tienda_id")
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("tiendas")
      .select("id, nombre, ciudad_id, owner_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recentUsers: RecentUser[] = (usersResult.data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
  }));

  return Response.json(
    {
      data: {
        counts: {
          profiles: profilesCount.count ?? 0,
          tiendas: tiendasCount.count ?? 0,
          torneos: torneosCount.count ?? 0,
          entries: entriesCount.count ?? 0,
          juegos: gamesCount.count ?? 0,
        },
        juegos: (juegosResult.data ?? []) as JuegoRow[],
        recentUsers,
        recentTorneos: (recentTorneosResult.data ?? []) as RecentTorneo[],
        recentStores: (recentStoresResult.data ?? []) as RecentStore[],
      },
    },
    { status: 200 },
  );
}

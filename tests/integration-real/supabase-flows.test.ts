import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function requireLocalEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name}. Ejecuta \`npm run test:integration:real\`.`,
    );
  }
  return value;
}

const supabaseUrl = requireLocalEnv("LOCAL_SUPABASE_URL");
const anonKey = requireLocalEnv("LOCAL_SUPABASE_ANON_KEY");
const serviceRoleKey = requireLocalEnv(
  "LOCAL_SUPABASE_SERVICE_ROLE_KEY",
);
const backendUrl = requireLocalEnv("LOCAL_BACKEND_URL");

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const admin = createClient(supabaseUrl, serviceRoleKey, clientOptions);
const suffix = randomUUID().slice(0, 8);
const password = "Prueba-local-123";

type TestIdentity = {
  id: string;
  email: string;
  client: SupabaseClient;
};

const identities: TestIdentity[] = [];
let owner: TestIdentity;
let playerOne: TestIdentity;
let playerTwo: TestIdentity;
let playerThree: TestIdentity;
let storeId: string;
let publishedTournamentId: string;
let draftTournamentId: string;

async function createIdentity(
  label: string,
  role: "jugador" | "tienda",
): Promise<TestIdentity> {
  const email = `${label}-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label },
  });

  if (error || !data.user) {
    throw error ?? new Error(`No se pudo crear ${label}`);
  }

  const { error: roleError } = await admin
    .from("profiles")
    .update({ user_role: role })
    .eq("user_id", data.user.id);

  if (roleError) throw roleError;

  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const { error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError) throw loginError;

  const identity = { id: data.user.id, email, client };
  identities.push(identity);
  return identity;
}

describe.sequential("integración real con Supabase local", () => {
  beforeAll(async () => {
    owner = await createIdentity("tienda", "tienda");
    playerOne = await createIdentity("jugador-uno", "jugador");
    playerTwo = await createIdentity("jugador-dos", "jugador");
    playerThree = await createIdentity("jugador-tres", "jugador");

    const { data: city, error: cityError } = await admin
      .from("ciudades")
      .select("id")
      .eq("nombre", "Santiago")
      .single();

    if (cityError) throw cityError;

    const { data: store, error: storeError } = await admin
      .from("tiendas")
      .insert({
        owner_id: owner.id,
        nombre: `Arena local ${suffix}`,
        ciudad_id: city.id,
      })
      .select("id")
      .single();

    if (storeError) throw storeError;
    storeId = store.id;

    const [{ data: game, error: gameError }, { data: category, error: categoryError }] =
      await Promise.all([
        admin.from("juegos").select("id").eq("key", "pokemon").single(),
        admin
          .from("categorias_torneo")
          .select("id")
          .eq("key", "local")
          .single(),
      ]);

    if (gameError) throw gameError;
    if (categoryError) throw categoryError;

    const tournamentBase = {
      tienda_id: storeId,
      descripcion: "Torneo creado por la integración local",
      direccion: "Av. Pruebas 123",
      fecha_inicio: "2099-08-25T23:00:00.000Z",
      cupo_maximo: 2,
      costo_entrada: 0,
      juego_id: game.id,
      categoria_id: category.id,
    };

    const { data: tournaments, error: tournamentError } = await admin
      .from("torneos")
      .insert([
        {
          ...tournamentBase,
          titulo: `Torneo público ${suffix}`,
          publicado: true,
        },
        {
          ...tournamentBase,
          titulo: `Torneo borrador ${suffix}`,
          publicado: false,
        },
      ])
      .select("id, publicado");

    if (tournamentError) throw tournamentError;

    publishedTournamentId = tournaments.find(
      (tournament) => tournament.publicado,
    )!.id;
    draftTournamentId = tournaments.find(
      (tournament) => !tournament.publicado,
    )!.id;
  });

  afterAll(async () => {
    await Promise.all(
      identities.map((identity) =>
        admin.auth.admin.deleteUser(identity.id, true),
      ),
    );
  });

  it("crea el perfil mediante Auth y limita su lectura al propietario", async () => {
    const { data: ownProfiles, error: ownError } = await playerOne.client
      .from("profiles")
      .select("user_id, user_role");

    expect(ownError).toBeNull();
    expect(ownProfiles).toEqual([
      { user_id: playerOne.id, user_role: "jugador" },
    ]);

    const { data: foreignProfiles, error: foreignError } =
      await playerOne.client
        .from("profiles")
        .select("user_id")
        .eq("user_id", playerTwo.id);

    expect(foreignError).toBeNull();
    expect(foreignProfiles).toEqual([]);
  });

  it("mantiene una sesión real a través de las rutas HTTP del backend", async () => {
    const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: playerOne.email,
        password,
        nextPath: "/jugador/perfil",
      }),
    });

    expect(loginResponse.status).toBe(200);

    const responseHeaders = loginResponse.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      responseHeaders.getSetCookie?.() ??
      [loginResponse.headers.get("set-cookie")].filter(
        (value): value is string => Boolean(value),
      );
    const cookieHeader = setCookies
      .map((cookie) => cookie.split(";", 1)[0])
      .join("; ");

    expect(cookieHeader).not.toBe("");

    const meResponse = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const mePayload = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(mePayload.data.user.email).toBe(playerOne.email);
    expect(mePayload.data.profile.user_role).toBe("jugador");
  });

  it("expone torneos publicados y reserva borradores para su tienda", async () => {
    const publicClient = createClient(supabaseUrl, anonKey, clientOptions);
    const { data: publicRows, error: publicError } = await publicClient
      .from("torneos")
      .select("id")
      .in("id", [publishedTournamentId, draftTournamentId]);

    expect(publicError).toBeNull();
    expect(publicRows?.map((row) => row.id)).toEqual([
      publishedTournamentId,
    ]);

    const { data: ownerRows, error: ownerError } = await owner.client
      .from("torneos")
      .select("id")
      .in("id", [publishedTournamentId, draftTournamentId]);

    expect(ownerError).toBeNull();
    expect(ownerRows).toHaveLength(2);
  });

  it("protege y conserva los atributos al modificar un torneo", async () => {
    const { data: playerUpdate, error: playerError } = await playerOne.client
      .from("torneos")
      .update({ titulo: "Edición no autorizada" })
      .eq("id", publishedTournamentId)
      .select("id");

    expect(playerError).toBeNull();
    expect(playerUpdate).toEqual([]);

    const expectedStartDate = "2099-09-10T18:30:00.000Z";
    const expectedAttributes = {
      titulo: `Actualizado ${suffix}`,
      descripcion: "Descripción persistida por la integración real",
      direccion: "Av. Integridad 456",
      fecha_inicio: expectedStartDate,
      cupo_maximo: 64,
      costo_entrada: 2500,
      publicado: true,
      latitud: -33.4489,
      longitud: -70.6693,
      imagen_url: "https://example.test/torneo.png",
    };
    const { data: ownerUpdate, error: ownerError } = await owner.client
      .from("torneos")
      .update(expectedAttributes)
      .eq("id", publishedTournamentId)
      .select(
        "id, titulo, descripcion, direccion, fecha_inicio, cupo_maximo, costo_entrada, publicado, latitud, longitud, imagen_url",
      )
      .single();

    expect(ownerError).toBeNull();
    expect(ownerUpdate).toMatchObject({
      id: publishedTournamentId,
      ...expectedAttributes,
      fecha_inicio: expect.any(String),
    });
    expect(new Date(ownerUpdate!.fecha_inicio).toISOString()).toBe(
      expectedStartDate,
    );

    const { data: persisted, error: persistedError } = await admin
      .from("torneos")
      .select(
        "titulo, descripcion, direccion, fecha_inicio, cupo_maximo, costo_entrada, publicado, latitud, longitud, imagen_url",
      )
      .eq("id", publishedTournamentId)
      .single();

    expect(persistedError).toBeNull();
    expect(persisted).toMatchObject({
      ...expectedAttributes,
      fecha_inicio: expect.any(String),
    });
    expect(new Date(persisted!.fecha_inicio).toISOString()).toBe(
      expectedStartDate,
    );
  });

  it("aplica RLS, unicidad, cupos y lista de espera al inscribir", async () => {
    const { error: capacityError } = await admin
      .from("torneos")
      .update({ cupo_maximo: 2 })
      .eq("id", publishedTournamentId);

    expect(capacityError).toBeNull();

    const { error: forgedError } = await playerOne.client
      .from("tournament_entries")
      .insert({
        torneo_id: publishedTournamentId,
        entry_type: "solo",
        user_id: playerTwo.id,
        status: "registered",
      });

    expect(forgedError?.code).toBe("42501");

    const registrations = [];
    for (const player of [playerOne, playerTwo, playerThree]) {
      const { data, error } = await player.client
        .from("tournament_entries")
        .insert({
          torneo_id: publishedTournamentId,
          entry_type: "solo",
          user_id: player.id,
          status: "registered",
        })
        .select("status")
        .single();

      expect(error).toBeNull();
      registrations.push(data!.status);
    }

    expect(registrations).toEqual([
      "registered",
      "registered",
      "waitlisted",
    ]);

    const { error: duplicateError } = await playerOne.client
      .from("tournament_entries")
      .insert({
        torneo_id: publishedTournamentId,
        entry_type: "solo",
        user_id: playerOne.id,
        status: "registered",
      });

    expect(duplicateError?.code).toBe("23505");
  });
});

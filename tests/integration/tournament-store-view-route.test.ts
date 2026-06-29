import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() asegura que los mocks existan antes de que los imports se resuelvan
const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

// Estas rutas solo usan createClient (no admin), por eso solo mockeamos server
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET as GET_LIST }   from "@/app/api/tiendas/me/torneos/route";
import { GET as GET_DETAIL } from "@/app/api/tiendas/me/torneos/[id]/route";

// ─── UUIDs de prueba ──────────────────────────────────────────────────────────
// UUIDs inventados en formato v4 válido para pasar la validación Zod de la ruta
const TOURNAMENT_ID  = "44444444-4444-4444-8444-444444444444";
const STORE_ID       = "55555555-5555-4555-8555-555555555555";
const USER_ID        = "11111111-1111-4111-8111-111111111111";
// ID del dueño de otra tienda — para simular acceso denegado en el test de 403
const OTHER_USER_ID  = "22222222-2222-4222-8222-222222222222";

// ─── Helpers de stub ──────────────────────────────────────────────────────────

// Simula: .select().eq().maybeSingle() → { data, error }
// Usado para: lookup de tienda por owner_id, lookup de torneo por id,
//             lookup de tienda para verificar ownership en detalle
function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq          = vi.fn(() => ({ maybeSingle }));
  const select      = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

// Simula: .select().eq().order() → { data[], error }
// Usado para: FROM torneos WHERE tienda_id = ? ORDER BY fecha_inicio DESC
// order() retorna una Promise directamente porque la ruta hace `await query`
function orderOf(data: unknown[], error: unknown = null) {
  const order  = vi.fn().mockResolvedValue({ data, error });
  const eq     = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, order };
}

// Simula auth.getUser() con usuario autenticado (id != null) o sin sesión (null)
function authOf(id: string | null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user: id ? { id } : null },
      // Supabase retorna error cuando no hay sesión activa
      error: id ? null : new Error("not-authenticated"),
    }),
  };
}

// Contexto de ruta dinámica de Next.js: { params: Promise<{ id }> }
function context(id = TOURNAMENT_ID) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/tiendas/me/torneos — lista de torneos de la tienda ──────────────

describe("GET /api/tiendas/me/torneos", () => {
  // mockReset() antes de cada test: limpia historial e implementación del mock
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("retorna los torneos de la tienda del usuario autenticado", async () => {
    // Torneo con juego_id y categoria_id en null para evitar queries adicionales
    // a las tablas `juegos` y `categorias_torneo` dentro de la ruta
    const torneo = {
      id: TOURNAMENT_ID,
      titulo: "Commander Night",
      fecha_inicio: "2026-07-01T18:00:00.000Z",
      juego_id: null,
      categoria_id: null,
      publicado: true,
    };

    // Stub para: FROM tiendas WHERE owner_id = USER_ID → { id, ciudad_id }
    // ciudad_id: null evita la query adicional a la tabla `ciudades`
    const tiendaQ  = maybeSingleOf({ id: STORE_ID, ciudad_id: null });
    // Stub para: FROM torneos WHERE tienda_id = STORE_ID ORDER BY fecha_inicio DESC
    const torneosQ = orderOf([torneo]);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID), // sesión activa
      from: vi.fn((table: string) => {
        // La ruta primero obtiene la tienda del usuario, luego lista sus torneos
        if (table === "tiendas") return { select: tiendaQ.select };
        if (table === "torneos") return { select: torneosQ.select };
        return {};
      }),
    });

    // GET_LIST no recibe parámetros porque obtiene el usuario desde la sesión
    const response = await GET_LIST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].titulo).toBe("Commander Night");
    // publicado se incluye en la respuesta de esta ruta (a diferencia de la pública)
    expect(body.data[0].publicado).toBe(true);
  });

  it("rechaza el acceso si el usuario no está autenticado", async () => {
    // authOf(null) simula una cuenta no logueada intentando acceder a los torneos.
    // Supabase retorna error en getUser() → la ruta devuelve 401.
    createClientMock.mockResolvedValue({
      auth: authOf(null),
      from: vi.fn(),
    });

    const response = await GET_LIST();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("No autenticado");
  });

  it("retorna lista vacía cuando el usuario autenticado no tiene tienda asociada", async () => {
    // maybeSingleOf(null) en tiendas: el usuario está autenticado pero no tiene tienda.
    // Puede ser un jugador u otro rol sin tienda registrada.
    // La ruta verifica !tienda (sin error de BD) → retorna [] con 200.
    const tiendaQ = maybeSingleOf(null);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const response = await GET_LIST();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });
});

// ─── GET /api/tiendas/me/torneos/:id — detalle de torneo de la tienda ─────────

describe("GET /api/tiendas/me/torneos/:id", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  // Torneo base reutilizado en varios tests de este describe.
  // juego_id y categoria_id en null evitan queries adicionales a sus tablas.
  const torneo = {
    id: TOURNAMENT_ID,
    tienda_id: STORE_ID,
    titulo: "Commander Night",
    descripcion: "Torneo casual",
    direccion: "Av. Test 123",
    fecha_inicio: "2026-07-01T18:00:00.000Z",
    cupo_maximo: 16,
    costo_entrada: 0,
    imagen_url: null,
    latitud: null,
    longitud: null,
    publicado: true,
    juego_id: null,
    categoria_id: null,
  };

  it("retorna el detalle del torneo cuando el usuario es dueño de la tienda", async () => {
    // Stub para: FROM torneos WHERE id = TOURNAMENT_ID
    const torneoQ = maybeSingleOf(torneo);
    // Stub para: FROM tiendas WHERE id = STORE_ID → { owner_id }
    // owner_id: USER_ID coincide con el usuario autenticado → acceso permitido
    const tiendaQ = maybeSingleOf({ owner_id: USER_ID });

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select };
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const response = await GET_DETAIL(new Request("http://localhost:3001"), context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.titulo).toBe("Commander Night");
    // Esta ruta incluye publicado en la respuesta (a diferencia de la ruta pública
    // que retorna 404 si es false — aquí el dueño puede ver sus torneos no publicados)
    expect(body.data.publicado).toBe(true);
  });

  it("rechaza el acceso cuando el usuario no es dueño del torneo", async () => {
    // El torneo existe, pero la tienda tiene owner_id = OTHER_USER_ID.
    // La ruta verifica: tienda.owner_id !== user.id → 403.
    // Simula el caso en que una tienda intenta ver el torneo de otra tienda.
    const torneoQ = maybeSingleOf(torneo);
    const tiendaQ = maybeSingleOf({ owner_id: OTHER_USER_ID }); // dueño diferente

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select };
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const response = await GET_DETAIL(new Request("http://localhost:3001"), context());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("No tienes acceso a este torneo");
  });

  it("responde 404 cuando el torneo no existe", async () => {
    // null en torneoQ simula que el SELECT no encontró el registro.
    // La ruta retorna 404 antes de consultar tiendas (early return).
    const torneoQ = maybeSingleOf(null);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select };
        return {};
      }),
    });

    const response = await GET_DETAIL(new Request("http://localhost:3001"), context());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Torneo no encontrado");
  });
});
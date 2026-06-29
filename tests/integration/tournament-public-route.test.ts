import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() garantiza que los mocks existan ANTES de que cualquier módulo
// importado se ejecute. Sin esto, vi.mock() podría fallar en ciertos entornos.
const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

// Reemplaza el módulo real de Supabase con nuestro mock.
// Cualquier ruta que haga `import { createClient } from "@/lib/supabase/server"`
// recibirá createClientMock en su lugar → la BD real nunca se toca.
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

// Las rutas GET públicas usan createAdminClient() para enriquecer datos
// (nombres de tienda, juego, categoría). Lo mockeamos para que retorne null,
// haciendo que la ruta use el cliente normal ya mockeado via el operador ??.
vi.mock("@/lib/supabase/admin", () => ({
  default: createAdminClientMock,
}));

import { GET as GET_LIST } from "@/app/api/torneos/route";
import { GET as GET_DETAIL } from "@/app/api/torneos/[id]/route";

// ─── UUIDs de prueba ──────────────────────────────────────────────────────────
// Valores fijos inventados que siguen el formato UUID v4.
// Son necesarios en este formato porque las rutas validan con z.string().uuid().
const TOURNAMENT_ID = "44444444-4444-4444-8444-444444444444";
const STORE_ID      = "55555555-5555-4555-8555-555555555555";

// ─── Helpers de stub ──────────────────────────────────────────────────────────
// Cada helper construye una cadena de vi.fn() que imita el query builder de
// Supabase. Usamos vi.fn() para que Vitest pueda rastrear llamadas y args.

// Simula: .select().eq().maybeSingle() → { data, error }
// Supabase lo usa cuando espera exactamente un registro o null.
function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq          = vi.fn(() => ({ maybeSingle }));
  const select      = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

// Simula: .select().eq().order() → { data[], error }
// Usado para listados ordenados (torneos por fecha_inicio ASC).
// order() retorna una Promise directamente porque la ruta hace `await query`.
function orderOf(data: unknown[], error: unknown = null) {
  const order  = vi.fn().mockResolvedValue({ data, error });
  const eq     = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, order };
}

// Simula: .select().in() → { data[], error }
// Usado para enriquecer torneos con datos de tiendas por lista de IDs.
function inOf(data: unknown[], error: unknown = null) {
  const inFn   = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ in: inFn }));
  return { select, inFn };
}

// Contexto de ruta dinámica de Next.js: { params: Promise<{ id }> }
function context(id = TOURNAMENT_ID) {
  return { params: Promise.resolve({ id }) };
}

// ─── GET /api/torneos — lista pública ────────────────────────────────────────

describe("GET /api/torneos", () => {
  // beforeEach corre antes de CADA test del describe.
  // mockReset() elimina tanto el historial de llamadas como la implementación
  // anterior, más completo que clearMocks: true del vitest.config.ts
  // (clearMocks solo limpia el historial, no el mockResolvedValue previo).
  beforeEach(() => {
    createClientMock.mockReset();
    // mockReturnValue (sin await) porque createAdminClient() es síncrono.
    // null fuerza a la ruta a usar supabase como metadataClient.
    createAdminClientMock.mockReturnValue(null);
  });

  it("retorna la lista de torneos publicados", async () => {
    // Objeto que imita la estructura real de la tabla `torneos`.
    // juego_id y categoria_id en null evitan queries adicionales a
    // las tablas `juegos` y `categorias_torneo` dentro de la misma ruta.
    const torneo = {
      id: TOURNAMENT_ID,
      tienda_id: STORE_ID,
      titulo: "Commander Night",
      descripcion: "Torneo casual",
      juego_id: null,
      categoria_id: null,
      direccion: "Av. Test 123",
      fecha_inicio: "2026-07-01T18:00:00.000Z",
      cupo_maximo: 16,
      costo_entrada: 0,
      imagen_url: null,
      latitud: null,
      longitud: null,
    };

    // Stub para: FROM torneos WHERE publicado = true ORDER BY fecha_inicio ASC
    const torneosQ = orderOf([torneo]);

    // Stub para el enrichment: FROM tiendas WHERE id IN ([STORE_ID])
    // ciudad_id: null evita la query adicional a la tabla `ciudades`.
    const tiendasQ = inOf([{ id: STORE_ID, nombre: "Tienda Alfa", ciudad_id: null }]);

    // Inyectamos el cliente Supabase falso.
    // La ruta llama `await createClient()` y recibe este objeto.
    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneosQ.select };
        if (table === "tiendas") return { select: tiendasQ.select };
        // Fallback para juegos/categorias_torneo/ciudades: retorna vacío
        // sin romper la ejecución. Solo se alcanza si juego_id != null.
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }),
    });

    const response = await GET_LIST(new Request("http://localhost:3001/api/torneos"));

    // Verificamos status y campos del cuerpo de respuesta
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].titulo).toBe("Commander Night");
    // tienda_nombre lo agrega la ruta al enriquecer con la tabla tiendas
    expect(body.data[0].tienda_nombre).toBe("Tienda Alfa");
  });

  it("retorna lista vacía cuando no hay torneos publicados", async () => {
    // orderOf([]) hace que la query principal devuelva un array vacío.
    // La ruta no llega a consultar tiendas/juegos/categorías porque no hay torneos.
    const torneosQ = orderOf([]);

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneosQ.select };
        return {};
      }),
    });

    const response = await GET_LIST(new Request("http://localhost:3001/api/torneos"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });

  it("rechaza un parámetro de categoría inválido", async () => {
    // La validación del query param ocurre ANTES de llamar a createClient(),
    // por eso el stub de Supabase no necesita comportamiento real aquí.
    createClientMock.mockResolvedValue({ from: vi.fn() });

    const response = await GET_LIST(
      new Request("http://localhost:3001/api/torneos?categoria=no-existe"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Categoría inválida");
  });
});

// ─── GET /api/torneos/:id — detalle público ───────────────────────────────────

describe("GET /api/torneos/:id", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    createAdminClientMock.mockReturnValue(null);
  });

  it("retorna el detalle de un torneo publicado", async () => {
    // publicado: true es obligatorio — la ruta retorna 404 si es false o null
    const torneo = {
      id: TOURNAMENT_ID,
      tienda_id: STORE_ID,
      titulo: "Commander Night",
      descripcion: "Torneo casual",
      juego_id: null,
      categoria_id: null,
      direccion: "Av. Test 123",
      fecha_inicio: "2026-07-01T18:00:00.000Z",
      cupo_maximo: 16,
      costo_entrada: 0,
      imagen_url: null,
      latitud: null,
      longitud: null,
      publicado: true,
    };

    // Stub para: FROM torneos WHERE id = TOURNAMENT_ID
    const torneoQ = maybeSingleOf(torneo);
    // Stub para: FROM tiendas WHERE id = STORE_ID (enrichment del nombre)
    // ciudad_id: null evita query adicional a la tabla `ciudades`
    const tiendaQ = maybeSingleOf({ nombre: "Tienda Alfa", ciudad_id: null });

    createClientMock.mockResolvedValue({
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
    expect(body.data.publicado).toBe(true);
    // tienda_nombre es un campo enriquecido que agrega la ruta al responder
    expect(body.data.tienda_nombre).toBe("Tienda Alfa");
  });

  it("responde 404 cuando el torneo no existe o no está publicado", async () => {
    // null de maybeSingle simula que no se encontró el registro.
    // La ruta trata igual un torneo inexistente y uno con publicado: false → 404.
    const torneoQ = maybeSingleOf(null);

    createClientMock.mockResolvedValue({
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

  it("rechaza un ID con formato inválido", async () => {
    // La validación UUID (z.string().uuid()) ocurre antes de consultar la BD.
    // "no-es-uuid" falla el schema → 400 sin llamar a Supabase.
    createClientMock.mockResolvedValue({ from: vi.fn() });

    const response = await GET_DETAIL(
      new Request("http://localhost:3001"),
      context("no-es-uuid"),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ID de torneo inválido");
  });
});

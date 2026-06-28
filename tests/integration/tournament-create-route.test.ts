import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() garantiza que los mocks existan antes de que los imports se resuelvan
const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

// Esta ruta solo usa createClient (no createAdminClient), por eso solo mockeamos server
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/torneos/crear/route";

// ─── UUIDs de prueba ──────────────────────────────────────────────────────────
// UUIDs inventados en formato v4 válido para pasar la validación Zod de la ruta
const TOURNAMENT_ID = "44444444-4444-4444-8444-444444444444";
const STORE_ID      = "55555555-5555-4555-8555-555555555555";
const USER_ID       = "11111111-1111-4111-8111-111111111111";

// ─── Helpers de stub ──────────────────────────────────────────────────────────

// Simula: .select().eq().maybeSingle() → { data, error }
// Usado para lookups de tienda (verificar que el usuario tiene tienda asociada)
function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq          = vi.fn(() => ({ maybeSingle }));
  const select      = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

// Simula: .insert().select().single() → { data, error }
// Usado para la inserción del torneo en la BD
function insertOf(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { insert, select, single };
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

// ─── POST /api/torneos/crear ──────────────────────────────────────────────────

describe("POST /api/torneos/crear", () => {
  // Limpiamos el mock antes de cada test para evitar que implementaciones
  // previas contaminen el siguiente test
  beforeEach(() => {
    createClientMock.mockReset();
  });

  // Body válido que cumple todos los campos requeridos del schema Zod de la ruta:
  // titulo (1-100 chars), descripcion (1-1200 chars), direccion (1-500 chars),
  // fecha_inicio (ISO string), cupo_maximo (int 2-1024), costo_entrada (0-1.000.000)
  const validBody = {
    titulo: "Commander Night",
    descripcion: "Torneo casual de Magic: The Gathering",
    direccion: "Av. Test 123, Santiago",
    fecha_inicio: "2026-07-01T18:00:00.000Z",
    cupo_maximo: 16,
    costo_entrada: 0,
  };

  it("crea el torneo cuando el usuario tiene tienda asociada", async () => {
    // Objeto que la ruta retornaría tras un INSERT exitoso
    const torneoCreado = { id: TOURNAMENT_ID, tienda_id: STORE_ID, ...validBody };

    // Stub para: FROM tiendas WHERE owner_id = USER_ID → tienda encontrada
    const tiendaQ = maybeSingleOf({ id: STORE_ID });
    // Stub para: INSERT INTO torneos (...) SELECT * RETURNING *
    const ins = insertOf(torneoCreado);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID), // usuario autenticado
      from: vi.fn((table: string) => {
        // La ruta primero consulta tiendas para verificar que el usuario tiene una
        if (table === "tiendas") return { select: tiendaQ.select };
        // Luego inserta el torneo con el tienda_id obtenido
        if (table === "torneos") return { insert: ins.insert };
        return {};
      }),
    });

    const req = new Request("http://localhost:3001/api/torneos/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.titulo).toBe("Commander Night");
    // Verificamos que insert fue llamado con el tienda_id correcto —
    // asegura que el torneo quedó asociado a la tienda del usuario y no a otra
    expect(ins.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tienda_id: STORE_ID, titulo: "Commander Night" }),
    );
  });

  it("rechaza la creación si el usuario no tiene tienda asociada", async () => {
    // Simula un jugador u otro rol sin tienda registrada en la tabla tiendas.
    // maybeSingleOf(null) → la query devuelve data: null (sin error de BD).
    // La ruta interpreta esto como "sin tienda" y retorna 403.
    const tiendaQ = maybeSingleOf(null);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const req = new Request("http://localhost:3001/api/torneos/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const response = await POST(req);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("No tienes tienda asociada");
  });

  it("rechaza body con campos requeridos faltantes", async () => {
    // El usuario tiene tienda y está autenticado, pero el body es inválido.
    // El schema Zod de la ruta falla porque faltan descripcion, direccion,
    // fecha_inicio, cupo_maximo y costo_entrada.
    const tiendaQ = maybeSingleOf({ id: STORE_ID });

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const req = new Request("http://localhost:3001/api/torneos/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "Solo título" }), // body incompleto
    });
    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Datos inválidos");
    // fieldErrors contiene qué campos fallaron la validación
    expect(body.fieldErrors).toBeDefined();
  });
});

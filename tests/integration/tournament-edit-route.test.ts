import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() asegura que los mocks estén listos antes de que se resuelvan los imports
const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

// PUT /api/torneos/:id/editar solo usa createClient, no el admin client
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { PUT } from "@/app/api/torneos/[id]/editar/route";

// ─── UUIDs de prueba ──────────────────────────────────────────────────────────
// UUIDs inventados en formato v4 válido para pasar z.string().uuid() de la ruta
const TOURNAMENT_ID = "44444444-4444-4444-8444-444444444444";
const STORE_ID      = "55555555-5555-4555-8555-555555555555";
// Tienda de otro usuario — usada para simular acceso denegado
const OTHER_STORE_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID        = "11111111-1111-4111-8111-111111111111";

// ─── Helpers de stub ──────────────────────────────────────────────────────────

// Simula: .select().eq().maybeSingle() → { data, error }
// Usado para: lookup del torneo por id (verificar existencia y obtener tienda_id)
//             lookup de la tienda por owner_id (verificar que el usuario es dueño)
function maybeSingleOf(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq          = vi.fn(() => ({ maybeSingle }));
  const select      = vi.fn(() => ({ eq }));
  return { select, eq, maybeSingle };
}

// Simula: .update().eq().select().single() → { data, error }
// Usado para: UPDATE torneos SET ... WHERE id = ?
function updateOf(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn(() => ({ single }));
  const eq     = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq, select, single };
}

// Simula auth.getUser() con usuario autenticado (id != null) o sin sesión (null)
function authOf(id: string | null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user: id ? { id } : null },
      error: id ? null : new Error("not-authenticated"),
    }),
  };
}

// Contexto de ruta dinámica de Next.js: { params: Promise<{ id }> }
function context(id = TOURNAMENT_ID) {
  return { params: Promise.resolve({ id }) };
}

// ─── PUT /api/torneos/:id/editar ──────────────────────────────────────────────

describe("PUT /api/torneos/:id/editar", () => {
  // mockReset() antes de cada test: limpia historial e implementación del mock
  beforeEach(() => {
    createClientMock.mockReset();
  });

  // Body válido con todos los campos requeridos por el schema Zod de la ruta
  const validBody = {
    titulo: "Commander Night Editado",
    descripcion: "Descripción actualizada del torneo",
    direccion: "Av. Nueva 456, Santiago",
    fecha_inicio: "2026-08-01T18:00:00.000Z",
    cupo_maximo: 32,
    costo_entrada: 500,
  };

  it("actualiza el torneo cuando el usuario es dueño de la tienda", async () => {
    const torneoActualizado = { id: TOURNAMENT_ID, ...validBody };

    // Stub para: FROM torneos WHERE id = TOURNAMENT_ID → { tienda_id: STORE_ID }
    // La ruta usa este dato para luego comparar con la tienda del usuario
    const torneoQ = maybeSingleOf({ tienda_id: STORE_ID });

    // Stub para: FROM tiendas WHERE owner_id = USER_ID → { id: STORE_ID }
    // STORE_ID coincide con torneoQ.tienda_id → el usuario es dueño → permite editar
    const tiendaQ = maybeSingleOf({ id: STORE_ID });

    // Stub para: UPDATE torneos SET ... WHERE id = TOURNAMENT_ID
    const upd = updateOf(torneoActualizado);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        // from("torneos") se llama dos veces:
        // 1ra: .select("tienda_id").eq(id).maybeSingle() → ownership check
        // 2da: .update({...}).eq(id).select().single() → actualización
        // Retornamos ambos métodos en el mismo objeto para que la ruta use
        // el que necesite en cada llamada.
        if (table === "torneos") return { select: torneoQ.select, update: upd.update };
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const req = new Request(`http://localhost:3001/api/torneos/${TOURNAMENT_ID}/editar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const response = await PUT(req, context());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.titulo).toBe("Commander Night Editado");
    // Verifica que todos los atributos llegan normalizados al UPDATE y que
    // los opcionales ausentes conservan una representación consistente.
    expect(upd.update).toHaveBeenCalledWith({
      titulo: "Commander Night Editado",
      descripcion: "Descripción actualizada del torneo",
      juego_id: null,
      categoria_id: null,
      direccion: "Av. Nueva 456, Santiago",
      fecha_inicio: "2026-08-01T18:00:00.000Z",
      cupo_maximo: 32,
      costo_entrada: 500,
      publicado: false,
      latitud: null,
      longitud: null,
      imagen_url: null,
    });
    // Verificamos que el WHERE apuntó al torneo correcto
    expect(upd.eq).toHaveBeenCalledWith("id", TOURNAMENT_ID);
  });

  it.each([
    ["título vacío", { ...validBody, titulo: "   " }, "titulo"],
    [
      "título demasiado largo",
      { ...validBody, titulo: "T".repeat(101) },
      "titulo",
    ],
    [
      "descripción vacía",
      { ...validBody, descripcion: "   " },
      "descripcion",
    ],
    [
      "descripción demasiado larga",
      { ...validBody, descripcion: "D".repeat(1201) },
      "descripcion",
    ],
    ["dirección vacía", { ...validBody, direccion: "   " }, "direccion"],
    ["fecha inexistente", { ...validBody, fecha_inicio: "no-es-fecha" }, null],
    ["cupo inferior al mínimo", { ...validBody, cupo_maximo: 1 }, "cupo_maximo"],
    ["cupo no entero", { ...validBody, cupo_maximo: 2.5 }, "cupo_maximo"],
    [
      "costo negativo",
      { ...validBody, costo_entrada: -1 },
      "costo_entrada",
    ],
    [
      "costo superior al máximo",
      { ...validBody, costo_entrada: 1_000_001 },
      "costo_entrada",
    ],
  ])("protege la integridad cuando recibe %s", async (_, invalidBody, expectedField) => {
    const torneoQ = maybeSingleOf({ tienda_id: STORE_ID });
    const tiendaQ = maybeSingleOf({ id: STORE_ID });
    const upd = updateOf(null);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select, update: upd.update };
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const req = new Request(`http://localhost:3001/api/torneos/${TOURNAMENT_ID}/editar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidBody),
    });
    const response = await PUT(req, context());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(upd.update).not.toHaveBeenCalled();

    if (expectedField) {
      expect(body.error).toBe("Datos inválidos");
      expect(body.fieldErrors).toHaveProperty(expectedField);
    } else {
      expect(body.error).toBe("Fecha no válida");
    }
  });

  it("rechaza la edición si el usuario no es dueño de la tienda del torneo", async () => {
    // El torneo pertenece a STORE_ID, pero la tienda del usuario es OTHER_STORE_ID.
    // La ruta verifica: tienda.id !== torneo.tienda_id → 403
    const torneoQ = maybeSingleOf({ tienda_id: STORE_ID });
    const tiendaQ = maybeSingleOf({ id: OTHER_STORE_ID }); // no coincide con STORE_ID

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select };
        if (table === "tiendas") return { select: tiendaQ.select };
        return {};
      }),
    });

    const req = new Request(`http://localhost:3001/api/torneos/${TOURNAMENT_ID}/editar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const response = await PUT(req, context());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("No puedes editar este torneo");
  });

  it("responde 404 cuando el torneo a editar no existe", async () => {
    // null en el stub simula que el SELECT no encontró el torneo.
    // La ruta retorna 404 antes de consultar tiendas o hacer el UPDATE.
    const torneoQ = maybeSingleOf(null);

    createClientMock.mockResolvedValue({
      auth: authOf(USER_ID),
      from: vi.fn((table: string) => {
        if (table === "torneos") return { select: torneoQ.select };
        return {};
      }),
    });

    const req = new Request(`http://localhost:3001/api/torneos/${TOURNAMENT_ID}/editar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const response = await PUT(req, context());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Torneo no encontrado");
  });
});

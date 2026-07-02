import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET as GET_GAMES } from "@/app/api/lookups/juegos/route";
import { GET as GET_CATEGORIES } from "@/app/api/lookups/categorias/route";
import { GET as GET_CITIES } from "@/app/api/lookups/ciudades/route";

describe("rutas de catálogos", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it.each([
    ["juegos", GET_GAMES],
    ["categorias_torneo", GET_CATEGORIES],
    ["ciudades", GET_CITIES],
  ])("GET del catálogo %s devuelve datos ordenados", async (table, handler) => {
    const rows = [{ id: "item-1", nombre: "Elemento" }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const select = vi.fn(() => ({ order }));
    const from = vi.fn(() => ({ select }));
    createClientMock.mockResolvedValue({ from });

    const response = await handler();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: rows });
    expect(from).toHaveBeenCalledWith(table);
    expect(order).toHaveBeenCalledWith("nombre", { ascending: true });
  });

  it("GET /api/lookups/juegos responde 500 ante un fallo de consulta", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: new Error("db-error") });
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ order })) })),
    });

    const response = await GET_GAMES();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "No se pudieron cargar los juegos" });
  });
});
